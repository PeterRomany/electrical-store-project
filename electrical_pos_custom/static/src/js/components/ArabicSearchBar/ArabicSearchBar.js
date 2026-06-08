/** @odoo-module **/

import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";

// =============================================================================
// ArabicSearchBar Component
// Replaces/extends standard POS search with full Arabic support
// Searches: name, alias, arabic_keywords, barcode, internal reference, brand
// =============================================================================

export class ArabicSearchBar extends Component {
    static template = "electrical_pos_custom.ArabicSearchBar";

    static props = {
        onSearch:       { type: Function },
        placeholder:    { type: String, optional: true },
        autofocus:      { type: Boolean, optional: true },
    };

    static defaultProps = {
        placeholder: "بحث بالاسم أو الباركود أو الكلمات العربية...",
        autofocus:   true,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.pos           = usePos();
        this.notification  = useService("notification");
        this.inputRef      = useRef("searchInput");

        this.state = useState({
            searchTerm:     '',
            isSearching:    false,
            resultCount:    0,
            showClear:      false,
            inputMode:      'text',   // 'text' | 'barcode'
        });

        // Debounce timer
        this._debounceTimer = null;

        onMounted(() => {
            if (this.props.autofocus && this.inputRef.el) {
                this.inputRef.el.focus();
            }
        });

        onWillUnmount(() => {
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Search Logic
    // -------------------------------------------------------------------------

    /**
     * Handle input change — debounce for typing, instant for barcode.
     * Barcode scanners fire input very fast (< 50ms per char).
     */
    onInput(ev) {
        const value = ev.target.value || '';
        this.state.searchTerm = value;
        this.state.showClear  = value.length > 0;

        // Clear existing debounce
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        if (value === '') {
            this._triggerSearch('');
            return;
        }

        // Barcode detection: if all characters are alphanumeric/dash
        // and value ends with Enter-equivalent, treat as barcode
        const looksLikeBarcode = /^[a-zA-Z0-9\-\_\.]+$/.test(value)
            && value.length >= 8;

        if (looksLikeBarcode) {
            // Instant search for barcodes
            this._triggerSearch(value);
        } else {
            // Debounce 300ms for keyboard typing (Arabic/Latin)
            this._debounceTimer = setTimeout(() => {
                this._triggerSearch(value);
            }, 300);
        }
    }

    /**
     * Handle Enter key — immediate search / barcode confirm.
     */
    onKeydown(ev) {
        if (ev.key === 'Enter') {
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
            }
            this._triggerSearch(this.state.searchTerm);
            ev.preventDefault();
        }

        if (ev.key === 'Escape') {
            this.clearSearch();
        }
    }

    /**
     * Execute search and notify parent component.
     * @param {string} term
     */
    _triggerSearch(term) {
        this.state.isSearching = true;

        const allProducts = this.pos.models['product.product']?.getAll() || [];

        let results;
        if (!term || term.trim() === '') {
            results = allProducts;
        } else {
            results = allProducts.filter(product =>
                product.matchesSearch(term)
            );
        }

        this.state.resultCount = results.length;
        this.state.isSearching = false;

        // Notify parent with filtered products
        this.props.onSearch(term, results);
    }

    // -------------------------------------------------------------------------
    // Clear
    // -------------------------------------------------------------------------

    clearSearch() {
        this.state.searchTerm = '';
        this.state.showClear  = false;
        this.state.resultCount = 0;

        if (this.inputRef.el) {
            this.inputRef.el.value = '';
            this.inputRef.el.focus();
        }

        this._triggerSearch('');
    }

    // -------------------------------------------------------------------------
    // Input Mode Toggle
    // -------------------------------------------------------------------------

    /**
     * Switch between text and barcode input mode.
     * In barcode mode, scanner input triggers instant search.
     */
    toggleInputMode() {
        this.state.inputMode = this.state.inputMode === 'text'
            ? 'barcode'
            : 'text';

        const placeholder = this.state.inputMode === 'barcode'
            ? 'امسح الباركود...'
            : this.props.placeholder;

        if (this.inputRef.el) {
            this.inputRef.el.placeholder = placeholder;
            this.inputRef.el.focus();
        }
    }

    // -------------------------------------------------------------------------
    // Computed
    // -------------------------------------------------------------------------

    get searchIcon() {
        return this.state.inputMode === 'barcode'
            ? 'fa-barcode'
            : 'fa-search';
    }

    get inputModeLabel() {
        return this.state.inputMode === 'barcode'
            ? 'باركود'
            : 'نص';
    }

    get resultLabel() {
        if (!this.state.searchTerm) return '';
        if (this.state.resultCount === 0) return 'لا توجد نتائج';
        return `${this.state.resultCount} نتيجة`;
    }

    get resultLabelClass() {
        if (this.state.resultCount === 0) return 'text-danger';
        return 'text-success';
    }
}