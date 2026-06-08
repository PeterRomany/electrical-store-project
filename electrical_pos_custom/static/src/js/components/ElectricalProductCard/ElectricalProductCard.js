/** @odoo-module **/

import { Component, useState, onWillStart, onWillUpdateProps } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

// =============================================================================
// ElectricalProductCard Component
// Extended product card for POS product list
// Shows: name, price, brand, watt, voltage, shelf, stock badge
// Supports: info popup trigger, packaging selector trigger
// =============================================================================

export class ElectricalProductCard extends Component {
    static template = "electrical_pos_custom.ElectricalProductCard";

    static props = {
        product:        { type: Object },
        onClick:        { type: Function, optional: true },
        onInfoClick:    { type: Function, optional: true },
        onPackClick:    { type: Function, optional: true },
        showStock:      { type: Boolean, optional: true },
        showElecInfo:   { type: Boolean, optional: true },
        showPackaging:  { type: Boolean, optional: true },
    };

    static defaultProps = {
        onClick:       () => {},
        onInfoClick:   () => {},
        onPackClick:   () => {},
        showStock:     true,
        showElecInfo:  true,
        showPackaging: true,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.pos          = usePos();
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            stockQty:    null,
            stockUom:    '',
            loadingStock: false,
        });

        onWillStart(async () => {
            if (this.props.showStock) {
                await this._loadStock();
            }
        });

        onWillUpdateProps(async (nextProps) => {
            if (nextProps.product?.id !== this.props.product?.id
                && nextProps.showStock) {
                await this._loadStock(nextProps.product);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Stock Loading
    // -------------------------------------------------------------------------

    /**
     * Load real-time stock quantity for this product.
     * Falls back to cached qty_available if RPC fails.
     *
     * @param {object|null} product — defaults to this.props.product
     */
    async _loadStock(product = null) {
        const prod = product || this.props.product;
        if (!prod?.id) return;

        this.state.loadingStock = true;

        try {
            const result = await this.orm.call(
                'pos.order',
                'get_product_stock_info',
                [prod.id],
                {}
            );
            this.state.stockQty  = result?.qty_available ?? 0;
            this.state.stockUom  = result?.uom_name || '';
        } catch {
            // Graceful fallback to cached value
            this.state.stockQty = prod.qty_available ?? 0;
            this.state.stockUom = '';
        } finally {
            this.state.loadingStock = false;
        }
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Stock quantity to display.
     * Uses loaded value or cached product value.
     * @returns {number}
     */
    get displayStock() {
        if (this.state.stockQty !== null) return this.state.stockQty;
        return this.props.product.qty_available ?? 0;
    }

    /**
     * Stock badge CSS class based on quantity.
     * @returns {string}
     */
    get stockBadgeClass() {
        const qty = this.displayStock;
        if (qty <= 0) return 'product-stock stock-zero';
        if (qty <= 5) return 'product-stock stock-low';
        return 'product-stock';
    }

    /**
     * Stock badge label.
     * @returns {string}
     */
    get stockBadgeLabel() {
        const qty = this.displayStock;
        if (this.state.loadingStock) return '...';
        if (qty <= 0) return 'نفذ';
        if (qty <= 5) return `${qty}⚠`;
        return `${qty}`;
    }

    /**
     * Product display name.
     * @returns {string}
     */
    get productName() {
        return this.props.product.display_name
            || this.props.product.name
            || '';
    }

    /**
     * Formatted product price.
     * @returns {string}
     */
    get productPrice() {
        try {
            const price = this.props.product.lst_price || 0;
            const symbol = this.pos.currency?.symbol || 'ج.م';
            return `${price.toFixed(2)} ${symbol}`;
        } catch {
            return `${(this.props.product.lst_price || 0).toFixed(2)} ج.م`;
        }
    }

    /**
     * Brand name — Arabic preferred.
     * @returns {string}
     */
    get brandName() {
        const product = this.props.product;
        if (!product.brand_id) return '';
        if (Array.isArray(product.brand_id)) {
            return product.brand_id[1] || '';
        }
        return product.brand_id?.name || '';
    }

    /**
     * Watt label with unit.
     * @returns {string}
     */
    get wattLabel() {
        const watt = this.props.product.watt;
        if (!watt || watt === 0) return '';
        return `${watt}W`;
    }

    /**
     * Voltage string.
     * @returns {string}
     */
    get voltageLabel() {
        return this.props.product.voltage || '';
    }

    /**
     * Shelf location string.
     * @returns {string}
     */
    get shelfLabel() {
        return this.props.product.shelf_location || '';
    }

    /**
     * Whether product has packaging options.
     * @returns {boolean}
     */
    get hasPackaging() {
        return (
            this.props.showPackaging &&
            this.props.product.packaging_ids &&
            this.props.product.packaging_ids.length > 0
        );
    }

    /**
     * Whether product is out of stock.
     * @returns {boolean}
     */
    get isOutOfStock() {
        return this.displayStock <= 0;
    }

    /**
     * Product image URL.
     * @returns {string}
     */
    get imageUrl() {
        const id = this.props.product.id;
        return id
            ? `/web/image/product.product/${id}/image_128`
            : '/web/static/img/placeholder.png';
    }

    // -------------------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------------------

    /**
     * Handle main card click — add product to order.
     * @param {Event} ev
     */
    onCardClick(ev) {
        ev.stopPropagation();
        this.props.onClick(this.props.product);
    }

    /**
     * Handle info button click — open ProductInfoPopup.
     * @param {Event} ev
     */
    onInfoClick(ev) {
        ev.stopPropagation();
        this.props.onInfoClick(this.props.product);
    }

    /**
     * Handle packaging button click — open PackagingSelectorPopup.
     * @param {Event} ev
     */
    onPackClick(ev) {
        ev.stopPropagation();
        this.props.onPackClick(this.props.product);
    }
}