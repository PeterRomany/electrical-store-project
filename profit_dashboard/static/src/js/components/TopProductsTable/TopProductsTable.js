/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

// =============================================================================
// TopProductsTable Component
// Displays top selling products ranked by revenue
// Shows: rank, name, brand, qty, revenue, margin %
// =============================================================================

export class TopProductsTable extends Component {
    static template = "profit_dashboard.TopProductsTable";

    static props = {
        products: { type: Array },
        loading:  { type: Boolean, optional: true },
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
            sortBy:  'revenue',
            sortDir: 'desc',
            limit:   10,
        });
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Sorted product list.
     * @returns {Array}
     */
    get sortedProducts() {
        if (!this.props.products || this.props.products.length === 0) {
            return [];
        }

        const sorted = [...this.props.products].sort((a, b) => {
            const aVal = a[this.state.sortBy] || 0;
            const bVal = b[this.state.sortBy] || 0;
            return this.state.sortDir === 'desc'
                ? bVal - aVal
                : aVal - bVal;
        });

        return sorted.slice(0, this.state.limit);
    }

    /**
     * Max revenue value for bar scaling.
     * @returns {number}
     */
    get maxRevenue() {
        if (!this.props.products || this.props.products.length === 0) return 1;
        return Math.max(...this.props.products.map(p => p.revenue || 0), 1);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Rank badge CSS class.
     * @param {number} index
     * @returns {string}
     */
    getRankClass(index) {
        const ranks = {
            0: 'rank-badge rank-1',
            1: 'rank-badge rank-2',
            2: 'rank-badge rank-3',
        };
        return ranks[index] || 'rank-badge rank-other';
    }

    /**
     * Revenue bar width percentage.
     * @param {number} revenue
     * @returns {string}
     */
    getRevenueBarWidth(revenue) {
        const pct = this.maxRevenue > 0
            ? (revenue / this.maxRevenue) * 100
            : 0;
        return `${Math.max(2, pct).toFixed(1)}%`;
    }

    /**
     * Margin badge CSS class.
     * @param {number} marginPct
     * @returns {string}
     */
    getMarginClass(marginPct) {
        if (marginPct >= 30) return 'margin-badge good';
        if (marginPct >= 15) return 'margin-badge ok';
        return 'margin-badge low';
    }

    /**
     * Format currency.
     * @param {number} value
     * @returns {string}
     */
    formatCurrency(value) {
        if (!value && value !== 0) return '—';
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ج.م`;
        if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}K ج.م`;
        return `${value.toFixed(2)} ج.م`;
    }

    /**
     * Format quantity.
     * @param {number} qty
     * @returns {string}
     */
    formatQty(qty) {
        if (!qty && qty !== 0) return '—';
        return qty.toFixed(qty % 1 === 0 ? 0 : 2);
    }

    // -------------------------------------------------------------------------
    // Sort Handler
    // -------------------------------------------------------------------------

    /**
     * Toggle sort column.
     * @param {string} column
     */
    sortBy(column) {
        if (this.state.sortBy === column) {
            this.state.sortDir = this.state.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            this.state.sortBy  = column;
            this.state.sortDir = 'desc';
        }
    }

    /**
     * Sort icon for column header.
     * @param {string} column
     * @returns {string}
     */
    getSortIcon(column) {
        if (this.state.sortBy !== column) return 'fa-sort';
        return this.state.sortDir === 'desc' ? 'fa-sort-down' : 'fa-sort-up';
    }

    // -------------------------------------------------------------------------
    // Drilldown
    // -------------------------------------------------------------------------

    onProductClick(product) {
        if (this.props.onDrilldown) {
            this.props.onDrilldown('product', product.id);
        }
    }
}