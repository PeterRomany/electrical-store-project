/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

// =============================================================================
// PackagingSelectorPopup Component
// Allows cashier to select packaging unit before adding product to order
// Supports: Piece, Box, Carton, Pack, Meter, Roll
// Automatically converts quantity to base UoM for inventory accuracy
// =============================================================================

export class PackagingSelectorPopup extends Component {
    static template = "electrical_pos_custom.PackagingSelectorPopup";
    static components = { Dialog };

    static props = {
        product:       { type: Object },
        defaultQty:    { type: Number, optional: true },
        title:         { type: String, optional: true },
        getPayload:    { type: Function },
        close:         { type: Function },
    };

    static defaultProps = {
        title:      'اختر وحدة التعبئة',
        defaultQty: 1,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.pos          = usePos();
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            loading:           true,
            packagingOptions:  [],
            selectedPackaging: null,
            qty:               this.props.defaultQty || 1,
            error:             null,
        });

        onWillStart(async () => {
            await this._loadPackagingOptions();
        });
    }

    // -------------------------------------------------------------------------
    // Data Loading
    // -------------------------------------------------------------------------

    /**
     * Load available packaging options for the product.
     * Always includes the base unit (Piece or Meter) as first option.
     */
    async _loadPackagingOptions() {
        this.state.loading = true;
        this.state.error   = null;

        try {
            const options = await this.orm.call(
                'pos.order',
                'get_product_packaging_options',
                [this.props.product.id],
                {}
            );

            this.state.packagingOptions = options || [];

            // Auto-select base unit by default
            if (this.state.packagingOptions.length > 0) {
                this.state.selectedPackaging = this.state.packagingOptions[0];
            }

        } catch (err) {
            this.state.error = 'تعذر تحميل وحدات التعبئة';
            // Build minimal fallback — base unit only
            this.state.packagingOptions = [{
                id:             0,
                name:           this.props.product.uom_id
                    ? (Array.isArray(this.props.product.uom_id)
                        ? this.props.product.uom_id[1]
                        : this.props.product.uom_id.name)
                    : 'قطعة',
                arabic_name:    'قطعة',
                display_name:   'قطعة',
                qty:            1.0,
                packaging_type: 'piece',
                barcode:        '',
                is_base:        true,
            }];
            this.state.selectedPackaging = this.state.packagingOptions[0];
        } finally {
            this.state.loading = false;
        }
    }

    // -------------------------------------------------------------------------
    // User Interactions
    // -------------------------------------------------------------------------

    /**
     * Select a packaging option.
     * @param {object} packaging
     */
    selectPackaging(packaging) {
        this.state.selectedPackaging = packaging;
    }

    /**
     * Increase qty by 1.
     */
    increaseQty() {
        this.state.qty = Math.max(1, this.state.qty + 1);
    }

    /**
     * Decrease qty by 1 (minimum 1).
     */
    decreaseQty() {
        this.state.qty = Math.max(1, this.state.qty - 1);
    }

    /**
     * Handle manual qty input.
     * @param {Event} ev
     */
    onQtyInput(ev) {
        const val = parseFloat(ev.target.value);
        if (!isNaN(val) && val > 0) {
            this.state.qty = val;
        }
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Returns computed base quantity after packaging conversion.
     * Example: 2 Boxes × 120 pieces/box = 240 pieces
     * @returns {number}
     */
    get baseQty() {
        if (!this.state.selectedPackaging) return this.state.qty;
        const packQty = this.state.selectedPackaging.qty || 1;
        return this.state.qty * packQty;
    }

    /**
     * Returns formatted base qty with UoM name.
     * @returns {string}
     */
    get baseQtyLabel() {
        const uomName = this.props.product.uom_id
            ? (Array.isArray(this.props.product.uom_id)
                ? this.props.product.uom_id[1]
                : this.props.product.uom_id.name)
            : 'قطعة';
        return `${this.baseQty} ${uomName}`;
    }

    /**
     * Returns packaging type icon class.
     * @param {string} packagingType
     * @returns {string}
     */
    getPackagingIcon(packagingType) {
        const icons = {
            piece:   'fa-cube',
            box:     'fa-box',
            carton:  'fa-archive',
            pack:    'fa-th-large',
            meter:   'fa-arrows-h',
            roll:    'fa-circle-o-notch',
        };
        return icons[packagingType] || 'fa-cube';
    }

    /**
     * Returns Arabic label for packaging type.
     * @param {object} pack
     * @returns {string}
     */
    getPackagingLabel(pack) {
        if (pack.arabic_name) return pack.arabic_name;
        const labels = {
            piece:   'قطعة',
            box:     'كرتونة',
            carton:  'كرتون',
            pack:    'باكيت',
            meter:   'متر',
            roll:    'لفة',
        };
        return labels[pack.packaging_type] || pack.name || 'قطعة';
    }

    /**
     * Returns qty description for a packaging option.
     * @param {object} pack
     * @returns {string}
     */
    getPackagingQtyDesc(pack) {
        if (pack.is_base) return 'الوحدة الأساسية';
        const uomName = this.props.product.uom_id
            ? (Array.isArray(this.props.product.uom_id)
                ? this.props.product.uom_id[1]
                : this.props.product.uom_id.name)
            : 'قطعة';
        return `= ${pack.qty} ${uomName}`;
    }

    /**
     * Returns CSS class for a packaging option card.
     * @param {object} pack
     * @returns {string}
     */
    getPackagingClass(pack) {
        const isSelected = this.state.selectedPackaging?.id === pack.id;
        return isSelected
            ? 'packaging-option selected'
            : 'packaging-option';
    }

    /**
     * Whether confirm button should be enabled.
     * @returns {boolean}
     */
    get canConfirm() {
        return (
            this.state.selectedPackaging !== null &&
            this.state.qty > 0 &&
            !this.state.loading
        );
    }

    // -------------------------------------------------------------------------
    // Confirm / Cancel
    // -------------------------------------------------------------------------

    /**
     * Confirm selection — return packaging and qty to caller.
     */
    confirm() {
        if (!this.canConfirm) return;

        this.props.getPayload({
            confirmed:         true,
            packaging:         this.state.selectedPackaging,
            qty:               this.state.qty,
            baseQty:           this.baseQty,
            product:           this.props.product,
        });
        this.props.close();
    }

    /**
     * Cancel — no selection made.
     */
    cancel() {
        this.props.getPayload({ confirmed: false });
        this.props.close();
    }
}
