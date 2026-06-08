/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { Product } from "@point_of_sale/app/store/models";

// =============================================================================
// Patch Product Model
// Extend standard POS Product with electrical store fields
// =============================================================================

patch(Product.prototype, {

    // -------------------------------------------------------------------------
    // Electrical Field Getters
    // -------------------------------------------------------------------------

    /**
     * Returns the brand name for display in POS.
     * @returns {string}
     */
    get electricalBrand() {
        if (!this.brand_id) return '';
        if (Array.isArray(this.brand_id)) return this.brand_id[1] || '';
        return this.brand_id.name || '';
    },

    /**
     * Returns formatted watt string.
     * @returns {string}
     */
    get electricalWatt() {
        if (!this.watt || this.watt === 0) return '';
        return `${this.watt}W`;
    },

    /**
     * Returns voltage string.
     * @returns {string}
     */
    get electricalVoltage() {
        return this.voltage || '';
    },

    /**
     * Returns shelf location string.
     * @returns {string}
     */
    get electricalShelf() {
        return this.shelf_location || '';
    },

    /**
     * Returns product alias.
     * @returns {string}
     */
    get electricalAlias() {
        return this.product_alias || '';
    },

    /**
     * Returns Arabic keywords string.
     * @returns {string}
     */
    get electricalKeywords() {
        return this.arabic_keywords || '';
    },

    /**
     * Returns warranty label.
     * @returns {string}
     */
    get electricalWarranty() {
        if (!this.warranty_months || this.warranty_months === 0) {
            return 'بدون ضمان';
        }
        if (this.warranty_months < 12) {
            return `${this.warranty_months} شهر`;
        }
        const years  = Math.floor(this.warranty_months / 12);
        const months = this.warranty_months % 12;
        let label = `${years} سنة`;
        if (months > 0) label += ` ${months} شهر`;
        return label;
    },

    // -------------------------------------------------------------------------
    // Arabic Search
    // -------------------------------------------------------------------------

    /**
     * Build a single lowercase search string from all searchable fields.
     * Used by ArabicSearchBar for multi-field matching.
     * @returns {string}
     */
    get searchableText() {
        const parts = [
            this.display_name        || '',
            this.name                || '',
            this.default_code        || '',
            this.barcode             || '',
            this.product_alias       || '',
            this.arabic_keywords     || '',
            this.electricalBrand,
            this.shelf_location      || '',
        ];
        return parts.join(' ').toLowerCase();
    },

    /**
     * Check if this product matches a search term.
     * Handles Arabic, Latin, barcode, alias, keywords.
     *
     * @param {string} searchTerm — raw search input from cashier
     * @returns {boolean}
     */
    matchesSearch(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') return true;

        const term = searchTerm.trim().toLowerCase();
        const text = this.searchableText;

        // Direct substring match
        if (text.includes(term)) return true;

        // Barcode exact match
        if (this.barcode && this.barcode === searchTerm.trim()) return true;

        // Internal reference exact / partial
        if (this.default_code &&
            this.default_code.toLowerCase().includes(term)) return true;

        // Multi-word Arabic keyword match
        // e.g. searching "ليد توفير" should match if both words exist
        const termWords = term.split(/\s+/).filter(Boolean);
        if (termWords.length > 1) {
            return termWords.every(word => text.includes(word));
        }

        return false;
    },

    // -------------------------------------------------------------------------
    // Stock Display
    // -------------------------------------------------------------------------

    /**
     * Returns stock status class for UI badge coloring.
     * @param {number} qty — current available qty
     * @returns {string} — 'in-stock' | 'low-stock' | 'out-of-stock'
     */
    getStockStatusClass(qty) {
        if (qty <= 0)  return 'out-of-stock';
        if (qty <= 5)  return 'low-stock';
        return 'in-stock';
    },

    /**
     * Returns Arabic stock label.
     * @param {number} qty
     * @returns {string}
     */
    getStockLabel(qty) {
        if (qty <= 0) return 'نفذ';
        if (qty <= 5) return `${qty} ⚠`;
        return `${qty}`;
    },

    // -------------------------------------------------------------------------
    // Packaging Helpers
    // -------------------------------------------------------------------------

    /**
     * Returns true if product has any packaging options.
     * @returns {boolean}
     */
    get hasPackaging() {
        return this.packaging_ids && this.packaging_ids.length > 0;
    },

    /**
     * Find a packaging record by barcode.
     * Used for barcode-triggered packaging selection.
     *
     * @param {string} barcode
     * @returns {object|null}
     */
    findPackagingByBarcode(barcode) {
        if (!barcode || !this.packaging_ids) return null;
        return this.packaging_ids.find(p => p.barcode === barcode) || null;
    },
});