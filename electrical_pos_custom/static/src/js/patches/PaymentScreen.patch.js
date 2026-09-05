/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useState } from "@odoo/owl";
import { ask, makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { NumberPopup } from "@point_of_sale/app/utils/input_popups/number_popup";

// =============================================================================
// PaymentScreen Patch
// Extends standard POS PaymentScreen with:
// - Credit limit validation before payment
// - Manager PIN override for blocked customers
// - Arabic warning/block messages
// - Customer balance display
// =============================================================================

patch(PaymentScreen.prototype, {

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        super.setup();

        this.pos          = usePos();
        this.dialog       = useService("dialog");
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.creditState = useState({
            checking:        false,
            creditResult:    null,
            overrideGranted: false,
            showBlockBanner: false,
            blockMessage:    '',
        });
    },

    // -------------------------------------------------------------------------
    // Override: validateOrder
    // -------------------------------------------------------------------------

    /**
     * Intercept standard validateOrder to inject credit check.
     * Called when cashier taps "Validate" on payment screen.
     */
    async validateOrder(isForceValidate) {
        // Only check if credit warning is enabled in config
        if (!this.pos.config?.iface_credit_warning) {
            return super.validateOrder(isForceValidate);
        }

        const order   = this.pos.get_order();
        const partner = order?.get_partner();

        if (!partner) {
            // No customer selected — skip credit check
            return super.validateOrder(isForceValidate);
        }

        // Run credit check
        const creditOk = await this._validateCredit(
            partner,
            order.get_total_with_tax()
        );

        if (!creditOk) {
            // Credit check failed and not overridden — stop payment
            return;
        }

        // Credit check passed — proceed with standard validation
        return super.validateOrder(isForceValidate);
    },

    // -------------------------------------------------------------------------
    // Credit Validation
    // -------------------------------------------------------------------------

    /**
     * Validate customer credit before payment.
     * Returns true if payment should proceed, false to block.
     *
     * @param {object} partner     — POS partner object
     * @param {number} orderAmount — total order amount
     * @returns {Promise<boolean>}
     */
    async _validateCredit(partner, orderAmount) {
        if (!partner?.id) return true;

        this.creditState.checking = true;

        try {
            const result = await this.orm.call(
                'pos.order',
                'check_credit_before_payment',
                [partner.id, orderAmount],
                {}
            );

            this.creditState.creditResult = result;

            if (result.status === 'ok') {
                // All clear — proceed
                this.creditState.checking = false;
                return true;
            }

            if (result.status === 'warning') {
                // Show warning but allow payment
                await this._showCreditWarning(partner, result);
                this.creditState.checking = false;
                return true;
            }

            if (result.status === 'blocked') {
                // Block payment — check for manager override
                const overridden = await this._handleCreditBlock(
                    partner,
                    result
                );
                this.creditState.checking = false;
                return overridden;
            }

            this.creditState.checking = false;
            return true;

        } catch (err) {
            // On RPC error — allow payment but log error
            console.error('[ElectricalPOS] Credit check error:', err);
            this.creditState.checking = false;
            return true;
        }
    },

    // -------------------------------------------------------------------------
    // Warning Handler
    // -------------------------------------------------------------------------

    /**
     * Show credit warning popup.
     * Warning = near limit but not blocked — cashier can proceed.
     *
     * @param {object} partner
     * @param {object} result — {status, message, allowed}
     */
    async _showCreditWarning(partner, result) {
        await ask(this.dialog, {
            title:         '⚠️ تحذير ائتماني',
            body:          result.message || `العميل ${partner.name} قارب على الحد الائتماني.`,
            confirmLabel:  'متابعة الدفع',
            cancelLabel:   'مراجعة الطلب',
        });
    },

    // -------------------------------------------------------------------------
    // Block Handler
    // -------------------------------------------------------------------------

    /**
     * Handle credit block situation.
     * Offers manager PIN override option.
     * Returns true if manager overrides, false if blocked.
     *
     * @param {object} partner
     * @param {object} result
     * @returns {Promise<boolean>}
     */
    async _handleCreditBlock(partner, result) {
        // Show block notification
        this.notification.add(
            `🚫 ${partner.name}: ${result.message}`,
            { type: 'danger', sticky: true }
        );

        // Ask if manager wants to override
        const confirmed = await ask(this.dialog, {
            title: '🚫 حساب محظور — تجاوز الحد الائتماني',
            body:
                `العميل: ${partner.name}\n` +
                `${result.message}\n\n` +
                `هل تريد طلب تجاوز من المدير؟`,
            confirmLabel: 'طلب تجاوز المدير',
            cancelLabel:  'إلغاء العملية',
        });

        if (!confirmed) {
            return false;
        }

        // Request manager PIN override
        return await this._requestManagerOverride(partner, result);
    },

    // -------------------------------------------------------------------------
    // Manager Override
    // -------------------------------------------------------------------------

    /**
     * Request manager PIN to override credit block.
     * Uses standard Odoo POS manager PIN mechanism.
     *
     * @param {object} partner
     * @param {object} result
     * @returns {Promise<boolean>}
     */
    async _requestManagerOverride(partner, result) {
        try {
            // Use standard Odoo POS manager access check
            const pin = await makeAwaitable(this.dialog, NumberPopup, {
                title:         'أدخل رقم PIN المدير',
                startingValue: '',
            });

            if (!pin) return false;

            // Verify manager PIN via RPC
            const isValid = await this.orm.call(
                'res.users',
                'check_pos_manager_pin',
                [pin],
                {}
            );

            if (isValid) {
                this.creditState.overrideGranted = true;
                this.notification.add(
                    `✅ تم التجاوز بواسطة المدير — العميل: ${partner.name}`,
                    { type: 'success', sticky: false }
                );
                return true;
            } else {
                this.notification.add(
                    '❌ رقم PIN غير صحيح — تم رفض التجاوز',
                    { type: 'danger', sticky: false }
                );
                return false;
            }

        } catch (err) {
            console.error('[ElectricalPOS] Manager override error:', err);
            this.notification.add(
                'تعذر التحقق من صلاحية المدير',
                { type: 'danger', sticky: false }
            );
            return false;
        }
    },

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Whether credit check is in progress.
     * Used to disable validate button during check.
     * @returns {boolean}
     */
    get isCreditChecking() {
        return this.creditState.checking;
    },

    /**
     * Current credit status of selected customer.
     * @returns {string|null}
     */
    get currentCreditStatus() {
        return this.creditState.creditResult?.status || null;
    },

    /**
     * Whether to show credit warning banner on payment screen.
     * @returns {boolean}
     */
    get showCreditBanner() {
        const status = this.currentCreditStatus;
        return status === 'warning' || status === 'blocked';
    },

    /**
     * Credit banner CSS class based on status.
     * @returns {string}
     */
    get creditBannerClass() {
        const status = this.currentCreditStatus;
        if (status === 'blocked') return 'alert alert-danger';
        if (status === 'warning') return 'alert alert-warning';
        return '';
    },

    /**
     * Credit banner message text.
     * @returns {string}
     */
    get creditBannerMessage() {
        return this.creditState.creditResult?.message || '';
    },

    /**
     * Whether validate button should be disabled.
     * @returns {boolean}
     */
    get isValidateDisabled() {
        return this.creditState.checking;
    },
});
