/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";
import { useState } from "@odoo/owl";
import { ElectricalProductCard } from "@electrical_pos_custom/js/components/ElectricalProductCard/ElectricalProductCard";
import { ProductInfoPopup } from "@electrical_pos_custom/js/components/ProductInfoPopup/ProductInfoPopup";
import { PackagingSelectorPopup } from "@electrical_pos_custom/js/components/ProductInfoPopup/PackagingSelectorPopup";

// The inherited POS template uses this component directly.
ProductScreen.components = {
    ...ProductScreen.components,
    ElectricalProductCard,
};

// =============================================================================
// ProductScreen Patch
// Extends standard POS ProductScreen with:
// - Arabic search bar integration
// - Electrical product card rendering
// - Product info popup
// - Packaging selector popup
// - RTL layout support
// =============================================================================

patch(ProductScreen.prototype, {

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        super.setup();

        this.pos          = usePos();
        this.dialog       = useService("dialog");
        this.notification = useService("notification");

        this.electricalState = useState({
            searchTerm:      '',
            filteredProducts: null,
            isFiltered:       false,
        });
    },

    // -------------------------------------------------------------------------
    // Arabic Search Integration
    // -------------------------------------------------------------------------

    /**
     * Called by ArabicSearchBar when search term changes.
     * Filters product list using extended matchesSearch logic.
     *
     * @param {string} term — raw search input
     * @param {Array}  results — pre-filtered product list from component
     */
    onArabicSearch(term, results) {
        this.electricalState.searchTerm      = term;
        this.electricalState.filteredProducts = results;
        this.electricalState.isFiltered       = term.length > 0;
        this.pos.searchProductWord = term;
    },

    /**
     * Returns the product list to display.
     * Uses filtered list if search is active, otherwise standard list.
     *
     * @returns {Array}
     */
    get electricalProductList() {
        if (this.electricalState.isFiltered) {
            return this.electricalState.filteredProducts || [];
        }
        // Fall back to standard Odoo product list
        return this.pos.models['product.product']?.getAll()?.filter(
            p => p.available_in_pos
        ) || [];
    },

    // Extend the native POS search so the normal top search field also finds
    // aliases and Arabic keywords loaded by electrical_product_model.js.
    getProductsBySearchWord(searchWord) {
        const products = this.pos.selectedCategory?.id
            ? this.getProductsByCategory(this.pos.selectedCategory)
            : this.products;
        const term = (searchWord || '').trim();
        const filteredProducts = products.filter((product) =>
            typeof product.matchesSearch === 'function'
                ? product.matchesSearch(term)
                : true
        );
        return filteredProducts.sort((a, b) =>
            (a.display_name || '').localeCompare(b.display_name || '')
        );
    },

    /**
     * Whether electrical search is active.
     * @returns {boolean}
     */
    get isElectricalSearchActive() {
        return this.electricalState.isFiltered;
    },

    /**
     * Whether arabic search feature is enabled in POS config.
     * @returns {boolean}
     */
    get arabicSearchEnabled() {
        return this.pos.config?.iface_arabic_search !== false;
    },

    /**
     * Whether stock display is enabled.
     * @returns {boolean}
     */
    get showStockEnabled() {
        return this.pos.config?.iface_show_stock !== false;
    },

    /**
     * Whether electrical info display is enabled.
     * @returns {boolean}
     */
    get showElecInfoEnabled() {
        return this.pos.config?.iface_show_electrical_info !== false;
    },

    /**
     * Whether packaging selector is enabled.
     * @returns {boolean}
     */
    get packagingEnabled() {
        return this.pos.config?.iface_packaging_selector !== false;
    },

    // -------------------------------------------------------------------------
    // Product Card Click Handlers
    // -------------------------------------------------------------------------

    /**
     * Handle product card click — add to order with base unit.
     * If packaging is enabled and product has packaging, open selector.
     *
     * @param {object} product
     */
    async onProductCardClick(product) {
        if (!product) return;

        // If packaging selector enabled and product has packaging
        if (this.packagingEnabled && product.hasPackaging) {
            await this._openPackagingSelector(product);
            return;
        }

        // Standard add to order
        await this._addProductToOrder(product, 1, null);
    },

    /**
     * Handle info button click on product card.
     * Opens ProductInfoPopup.
     *
     * @param {object} product
     */
    async onProductInfoClick(product) {
        if (!product) return;

        const result = await makeAwaitable(
            this.dialog,
            ProductInfoPopup,
            {
                product: product,
                title:   'معلومات المنتج',
            }
        );

        if (result?.confirmed) {
            const { packaging } = result;
            if (packaging && !packaging.is_base) {
                await this._addProductToOrder(product, packaging.qty, packaging);
            } else {
                await this._addProductToOrder(product, 1, null);
            }
        }
    },

    /**
     * Handle packaging button click on product card.
     * Opens PackagingSelectorPopup directly.
     *
     * @param {object} product
     */
    async onProductPackClick(product) {
        if (!product) return;
        await this._openPackagingSelector(product);
    },

    // -------------------------------------------------------------------------
    // Packaging Selector
    // -------------------------------------------------------------------------

    /**
     * Open packaging selector popup and handle result.
     * @param {object} product
     */
    async _openPackagingSelector(product) {
        const result = await makeAwaitable(
            this.dialog,
            PackagingSelectorPopup,
            {
                product:    product,
                defaultQty: 1,
                title:      'اختر وحدة التعبئة',
            }
        );

        if (result?.confirmed) {
            await this._addProductToOrder(
                result.product,
                result.baseQty,
                result.packaging,
            );
        }
    },

    // -------------------------------------------------------------------------
    // Order Line Addition
    // -------------------------------------------------------------------------

    /**
     * Add product to current POS order with specified quantity.
     * Handles packaging conversion — always adds in BASE unit qty.
     *
     * @param {object}      product   — product.product record
     * @param {number}      qty       — quantity in BASE units
     * @param {object|null} packaging — selected packaging option (for display)
     */
    async _addProductToOrder(product, qty, packaging) {
        if (!product || qty <= 0) return;

        const order = this.pos.get_order();
        if (!order) return;

        try {
            // Odoo 18 adds products through the POS store API.
            // Packaging is represented by its converted base quantity.
            await this.pos.addLineToCurrentOrder({
                product_id: product,
                qty,
            });

            // Show notification for packaging selection
            if (packaging && !packaging.is_base) {
                this.notification.add(
                    `تم إضافة ${qty} ${this._getUomName(product)} `
                    + `(${packaging.display_name || packaging.name})`,
                    {
                        type:    'success',
                        sticky: false,
                    }
                );
            }
        } catch (err) {
            this.notification.add(
                'حدث خطأ أثناء إضافة المنتج للطلب',
                { type: 'danger', sticky: false }
            );
            console.error('[ElectricalPOS] Error adding product:', err);
        }
    },

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Get UoM name for a product.
     * @param {object} product
     * @returns {string}
     */
    _getUomName(product) {
        if (!product.uom_id) return '';
        if (Array.isArray(product.uom_id)) {
            return product.uom_id[1] || '';
        }
        return product.uom_id?.name || '';
    },

    /**
     * Whether RTL layout is enabled.
     * @returns {boolean}
     */
    get isRtlEnabled() {
        return this.pos.config?.iface_rtl !== false;
    },

    /**
     * Returns RTL class string if enabled.
     * @returns {string}
     */
    get rtlClass() {
        return this.isRtlEnabled ? 'pos-rtl' : '';
    },
});
