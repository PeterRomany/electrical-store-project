/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

// =============================================================================
// LowStockAlert Component
// Displays products with low or zero stock
// Shows: product name, code, shelf, qty badge
// =============================================================================

export class LowStockAlert extends Component {
    static template = "profit_dashboard.LowStockAlert";

    static props = {
        items:       { type: Array },
        loading:     { type: Boolean, optional: true },
        onDrilldown: { type: Function, optional: true },
    };

    static defaultProps = {
        loading:     false,
        onDrilldown: null,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.state = useState({
            showAll:  false,
            filter:   'all',
        });
    }

    // -------------------------------------------------------------------------
    // Computed
    // -------------------------------------------------------------------------

    /**
     * Filtered and limited items list.
     * @returns {Array}
     */
    get displayItems() {
        if (!this.props.items || this.props.items.length === 0) return [];

        let items = [...this.props.items];

        if (this.state.filter === 'zero') {
            items = items.filter(i => i.is_zero);
        } else if (this.state.filter === 'low') {
            items = items.filter(i => i.is_low);
        }

        return this.state.showAll ? items : items.slice(0, 8);
    }

    /**
     * Count of zero-stock items.
     * @returns {number}
     */
    get zeroCount() {
        return (this.props.items || []).filter(i => i.is_zero).length;
    }

    /**
     * Count of low-stock items.
     * @returns {number}
     */
    get lowCount() {
        return (this.props.items || []).filter(i => i.is_low).length;
    }

    /**
     * Total alert count.
     * @returns {number}
     */
    get totalCount() {
        return (this.props.items || []).length;
    }

    /**
     * Whether "show more" button should appear.
     * @returns {boolean}
     */
    get hasMore() {
        const items = this.props.items || [];
        return !this.state.showAll && items.length > 8;
    }

    /**
     * Remaining item count.
     * @returns {number}
     */
    get remainingCount() {
        return (this.props.items || []).length - 8;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * CSS class for stock qty badge.
     * @param {object} item
     * @returns {string}
     */
    getStockBadgeClass(item) {
        return item.is_zero ? 'stock-qty-badge zero' : 'stock-qty-badge low';
    }

    /**
     * Stock qty label.
     * @param {object} item
     * @returns {string}
     */
    getStockLabel(item) {
        if (item.is_zero) return 'نفذ';
        return `${item.qty_available} ${item.uom || ''}`;
    }

    /**
     * Item row CSS class.
     * @param {object} item
     * @returns {string}
     */
    getItemClass(item) {
        return item.is_zero ? 'low-stock-item stock-zero' : 'low-stock-item stock-low';
    }

    /**
     * Filter button CSS class.
     * @param {string} filterValue
     * @returns {string}
     */
    getFilterClass(filterValue) {
        return this.state.filter === filterValue
            ? 'btn btn-sm btn-primary'
            : 'btn btn-sm btn-outline-secondary';
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    setFilter(filter) {
        this.state.filter  = filter;
        this.state.showAll = false;
    }

    toggleShowAll() {
        this.state.showAll = !this.state.showAll;
    }

    onItemClick(item) {
        if (this.props.onDrilldown) {
            this.props.onDrilldown('product', item.id);
        }
    }
}