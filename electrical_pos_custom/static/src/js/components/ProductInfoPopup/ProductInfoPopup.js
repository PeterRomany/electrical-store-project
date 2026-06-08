/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { AbstractAwaitablePopup } from "@point_of_sale/app/popup/abstract_awaitable_popup";

// =============================================================================
// ProductInfoPopup Component
// Shows full electrical product info when cashier taps product info button
// Displays: stock, brand, watt, voltage, warranty, shelf, alias, packaging
// =============================================================================

export class ProductInfoPopup extends AbstractAwaitablePopup {
    static template = "electrical_pos_custom.ProductInfoPopup";

    static props = {
        ...AbstractAwaitablePopup.props,
        product:     { type: Object },
        productInfo: { type: Object, optional: true },
    };

    static defaultProps = {
        ...AbstractAwaitablePopup.defaultProps,
        title:       'معلومات المنتج',
        productInfo: null,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        super.setup();
        this.pos          = usePos();
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            loading:        true,
            electricalInfo: null,
            stockInfo:      null,
            packagingList:  [],
            error:          null,
        });

        onWillStart(async () => {
            await this._loadProductData();
        });
    }

    // -------------------------------------------------------------------------
    // Data Loading
    // -------------------------------------------------------------------------

    /**
     * Load electrical info, stock, and packaging in parallel.
     */
    async _loadProductData() {
        this.state.loading = true;
        this.state.error   = null;

        try {
            const product = this.props.product;
            const tmplId  = product.product_tmpl_id
                ? (Array.isArray(product.product_tmpl_id)
                    ? product.product_tmpl_id[0]
                    : product.product_tmpl_id)
                : null;

            const [electricalInfo, stockInfo, packagingList] = await Promise.all([
                // Electrical specs
                tmplId
                    ? this.orm.call(
                        'pos.order',
                        'get_product_electrical_info',
                        [tmplId],
                        {}
                      )
                    : Promise.resolve({}),

                // Stock qty
                this.orm.call(
                    'pos.order',
                    'get_product_stock_info',
                    [product.id],
                    {}
                ),

                // Packaging options
                this.orm.call(
                    'pos.order',
                    'get_product_packaging_options',
                    [product.id],
                    {}
                ),
            ]);

            this.state.electricalInfo = electricalInfo || {};
            this.state.stockInfo      = stockInfo || {};
            this.state.packagingList  = packagingList || [];

        } catch (err) {
            this.state.error = 'تعذر تحميل معلومات المنتج';
            // Use cached product data as fallback
            this.state.electricalInfo = this._buildFromProduct(this.props.product);
            this.state.stockInfo = {
                qty_available: this.props.product.qty_available || 0,
                uom_name:      this.props.product.uom_id
                    ? (Array.isArray(this.props.product.uom_id)
                        ? this.props.product.uom_id[1]
                        : this.props.product.uom_id.name)
                    : '',
            };
        } finally {
            this.state.loading = false;
        }
    }

    /**
     * Build info from cached POS product data.
     * @param {object} product
     * @returns {object}
     */
    _buildFromProduct(product) {
        return {
            brand:           product.electricalBrand || '',
            brand_arabic:    '',
            watt:            product.watt || 0,
            voltage:         product.voltage || '',
            warranty_months: product.warranty_months || 0,
            shelf_location:  product.shelf_location || '',
            product_alias:   product.product_alias || '',
            arabic_keywords: product.arabic_keywords || '',
        };
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    get productName() {
        return this.props.product.display_name
            || this.props.product.name
            || '';
    }

    get productCode() {
        return this.props.product.default_code || '';
    }

    get productBarcode() {
        return this.props.product.barcode || '';
    }

    get productPrice() {
        try {
            const pricelist = this.pos.pricelists?.find(
                p => p.id === this.pos.config.pricelist_id?.[0]
            );
            const price = this.props.product.getPrice(pricelist, 1);
            return `${(price || 0).toFixed(2)} ج.م`;
        } catch {
            return `${(this.props.product.lst_price || 0).toFixed(2)} ج.م`;
        }
    }

    get stockQty() {
        return this.state.stockInfo?.qty_available ?? 0;
    }

    get stockUom() {
        return this.state.stockInfo?.uom_name || '';
    }

    get stockStatusClass() {
        const qty = this.stockQty;
        if (qty <= 0)  return 'out-of-stock';
        if (qty <= 5)  return 'low-stock';
        return 'in-stock';
    }

    get stockLabel() {
        const qty = this.stockQty;
        if (qty <= 0) return 'نفذ من المخزن';
        if (qty <= 5) return `${qty} ${this.stockUom} — كمية منخفضة`;
        return `${qty} ${this.stockUom}`;
    }

    get brand() {
        const info = this.state.electricalInfo;
        if (!info) return '';
        return info.brand_arabic || info.brand || '';
    }

    get watt() {
        const info = this.state.electricalInfo;
        if (!info || !info.watt) return '';
        return `${info.watt} واط`;
    }

    get voltage() {
        return this.state.electricalInfo?.voltage || '';
    }

    get warrantyLabel() {
        const months = this.state.electricalInfo?.warranty_months || 0;
        if (!months) return 'بدون ضمان';
        if (months < 12) return `${months} شهر`;
        const years  = Math.floor(months / 12);
        const rem    = months % 12;
        let label    = `${years} سنة`;
        if (rem > 0) label += ` ${rem} شهر`;
        return label;
    }

    get shelfLocation() {
        return this.state.electricalInfo?.shelf_location || '';
    }

    get productAlias() {
        return this.state.electricalInfo?.product_alias || '';
    }

    get hasPackaging() {
        return this.state.packagingList && this.state.packagingList.length > 1;
    }

    get packagingList() {
        return this.state.packagingList || [];
    }

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------

    /**
     * Close popup — no selection made.
     */
    cancel() {
        this.props.close({ confirmed: false });
    }

    /**
     * Confirm: add product to order using base unit.
     */
    confirm() {
        this.props.close({
            confirmed:    true,
            product:      this.props.product,
            packaging:    null,
        });
    }

    /**
     * Confirm with a specific packaging option.
     * @param {object} packaging
     */
    selectPackaging(packaging) {
        this.props.close({
            confirmed: true,
            product:   this.props.product,
            packaging: packaging,
        });
    }
}