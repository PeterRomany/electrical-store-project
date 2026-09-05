/** @odoo-module **/

import { Component, useState, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

// =============================================================================
// CustomerCreditWidget Component
// Displays customer credit status, balance, and type in POS
// Shown when a customer is selected on the ProductScreen
// =============================================================================

export class CustomerCreditWidget extends Component {
    static template = "electrical_pos_custom.CustomerCreditWidget";

    static props = {
        partner: { type: Object, optional: true },
    };

    static defaultProps = {
        partner: null,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.pos          = usePos();
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            loading:           false,
            creditInfo:        null,
            error:             null,
        });

        // Load credit info when partner prop changes
        onWillUpdateProps(async (nextProps) => {
            if (nextProps.partner?.id !== this.props.partner?.id) {
                await this._loadCreditInfo(nextProps.partner);
            }
        });

        // Load on mount if partner already set
        if (this.props.partner) {
            this._loadCreditInfo(this.props.partner);
        }
    }

    // -------------------------------------------------------------------------
    // Data Loading
    // -------------------------------------------------------------------------

    /**
     * Fetch credit info from server for selected partner.
     * Falls back to cached partner data if RPC fails.
     *
     * @param {object|null} partner
     */
    async _loadCreditInfo(partner) {
        if (!partner || !partner.id) {
            this.state.creditInfo = null;
            return;
        }

        this.state.loading = true;
        this.state.error   = null;

        try {
            const info = await this.orm.call(
                'pos.order',
                'get_customer_credit_info',
                [partner.id],
                {}
            );

            if (info && Object.keys(info).length > 0) {
                this.state.creditInfo = info;
            } else {
                // Use cached partner data from POS session
                this.state.creditInfo = this._buildFromPartner(partner);
            }
        } catch (err) {
            // Gracefully fall back to cached data
            this.state.creditInfo = this._buildFromPartner(partner);
            this.state.error = 'تعذر تحميل بيانات الائتمان';
        } finally {
            this.state.loading = false;
        }
    }

    /**
     * Build credit info dict from cached POS partner object.
     * Used as fallback when RPC is unavailable.
     *
     * @param {object} partner
     * @returns {object}
     */
    _buildFromPartner(partner) {
        return {
            id:                 partner.id,
            name:               partner.name || '',
            customer_type:      partner.customer_type || 'retail',
            credit_limit:       partner.credit_limit || 0.0,
            credit_used:        partner.credit_used || 0.0,
            credit_available:   partner.credit_available || 0.0,
            credit_status:      partner.credit_status || 'ok',
            warning_threshold:  partner.warning_threshold || 80.0,
            blocking_threshold: partner.blocking_threshold || 100.0,
        };
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Returns CSS class based on credit status.
     * @returns {string}
     */
    get widgetClass() {
        if (!this.state.creditInfo) return 'customer-credit-widget';
        const status = this.state.creditInfo.credit_status || 'ok';
        return `customer-credit-widget status-${status}`;
    }

    /**
     * Returns credit usage percentage (0–100).
     * @returns {number}
     */
    get usagePercentage() {
        const info = this.state.creditInfo;
        if (!info || !info.credit_limit || info.credit_limit <= 0) return 0;
        return Math.min(100, (info.credit_used / info.credit_limit) * 100);
    }

    /**
     * Returns formatted credit limit string.
     * @returns {string}
     */
    get formattedLimit() {
        const info = this.state.creditInfo;
        if (!info) return '—';
        if (!info.credit_limit || info.credit_limit <= 0) return 'غير محدود';
        return this._formatAmount(info.credit_limit);
    }

    /**
     * Returns formatted credit used string.
     * @returns {string}
     */
    get formattedUsed() {
        const info = this.state.creditInfo;
        if (!info) return '—';
        return this._formatAmount(info.credit_used || 0);
    }

    /**
     * Returns formatted credit available string.
     * @returns {string}
     */
    get formattedAvailable() {
        const info = this.state.creditInfo;
        if (!info) return '—';
        return this._formatAmount(info.credit_available || 0);
    }

    /**
     * Returns Arabic status label.
     * @returns {string}
     */
    get statusLabel() {
        const statusMap = {
            ok:      '✅ جيد',
            warning: '⚠️ تحذير',
            blocked: '🚫 محظور',
        };
        const info = this.state.creditInfo;
        if (!info) return '';
        return statusMap[info.credit_status] || '✅ جيد';
    }

    /**
     * Returns Arabic customer type label.
     * @returns {string}
     */
    get customerTypeLabel() {
        const typeMap = {
            retail:      'تجزئة',
            electrician: 'كهربائي',
            contractor:  'مقاول',
            company:     'شركة',
        };
        const info = this.state.creditInfo;
        if (!info) return '';
        return typeMap[info.customer_type] || 'تجزئة';
    }

    /**
     * Returns customer type CSS class.
     * @returns {string}
     */
    get customerTypeBadgeClass() {
        const info = this.state.creditInfo;
        if (!info) return 'customer-type-badge retail';
        return `customer-type-badge ${info.customer_type || 'retail'}`;
    }

    /**
     * Returns status icon character.
     * @returns {string}
     */
    get statusIcon() {
        const info = this.state.creditInfo;
        if (!info) return '';
        const icons = { ok: '✅', warning: '⚠️', blocked: '🚫' };
        return icons[info.credit_status] || '✅';
    }

    /**
     * Whether to show the credit section at all.
     * Only shown if credit limit is configured.
     * @returns {boolean}
     */
    get hasCreditLimit() {
        const info = this.state.creditInfo;
        return info && info.credit_limit > 0;
    }

    /**
     * Bar width style for credit usage progress bar.
     * @returns {string}
     */
    get barStyle() {
        return `width: ${this.usagePercentage.toFixed(1)}%`;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Format a monetary amount using company currency symbol.
     * @param {number} amount
     * @returns {string}
     */
    _formatAmount(amount) {
        try {
            return this.env.utils.formatCurrency(amount);
        } catch {
            return `${(amount || 0).toFixed(2)} ج.م`;
        }
    }
}
