/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

// =============================================================================
// TopCustomersTable Component
// Displays top customers ranked by revenue
// Shows: rank, name, customer type, order count, revenue
// =============================================================================

export class TopCustomersTable extends Component {
    static template = "profit_dashboard.TopCustomersTable";

    static props = {
        customers:   { type: Array },
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
            sortBy:  'revenue',
            sortDir: 'desc',
        });
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Sorted customer list.
     * @returns {Array}
     */
    get sortedCustomers() {
        if (!this.props.customers || this.props.customers.length === 0) {
            return [];
        }
        return [...this.props.customers].sort((a, b) => {
            const aVal = a[this.state.sortBy] || 0;
            const bVal = b[this.state.sortBy] || 0;
            return this.state.sortDir === 'desc'
                ? bVal - aVal
                : aVal - bVal;
        });
    }

    /**
     * Max revenue for bar scaling.
     * @returns {number}
     */
    get maxRevenue() {
        if (!this.props.customers || this.props.customers.length === 0) return 1;
        return Math.max(
            ...this.props.customers.map(c => c.revenue || 0), 1
        );
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
     * Customer type badge CSS class.
     * @param {string} type
     * @returns {string}
     */
    getTypeClass(type) {
        const classes = {
            retail:      'customer-type-badge retail',
            electrician: 'customer-type-badge electrician',
            contractor:  'customer-type-badge contractor',
            company:     'customer-type-badge company',
        };
        return classes[type] || 'customer-type-badge retail';
    }

    /**
     * Arabic customer type label.
     * @param {string} type
     * @returns {string}
     */
    getTypeLabel(type) {
        const labels = {
            retail:      'تجزئة',
            electrician: 'كهربائي',
            contractor:  'مقاول',
            company:     'شركة',
        };
        return labels[type] || 'تجزئة';
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

    // -------------------------------------------------------------------------
    // Sort
    // -------------------------------------------------------------------------

    sortBy(column) {
        if (this.state.sortBy === column) {
            this.state.sortDir = this.state.sortDir === 'desc' ? 'asc' : 'desc';
        } else {
            this.state.sortBy  = column;
            this.state.sortDir = 'desc';
        }
    }

    getSortIcon(column) {
        if (this.state.sortBy !== column) return 'fa-sort';
        return this.state.sortDir === 'desc' ? 'fa-sort-down' : 'fa-sort-up';
    }

    // -------------------------------------------------------------------------
    // Drilldown
    // -------------------------------------------------------------------------

    onCustomerClick(customer) {
        if (this.props.onDrilldown) {
            this.props.onDrilldown('customer', customer.id);
        }
    }
}