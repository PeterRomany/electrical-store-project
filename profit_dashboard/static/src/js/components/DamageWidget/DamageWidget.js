/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

// =============================================================================
// DamageWidget Component
// Displays damage summary for the period
// Shows: total value, count, breakdown by reason
// =============================================================================

export class DamageWidget extends Component {
    static template = "profit_dashboard.DamageWidget";

    static props = {
        data:        { type: Object, optional: true },
        loading:     { type: Boolean, optional: true },
        onDrilldown: { type: Function, optional: true },
    };

    static defaultProps = {
        data:        null,
        loading:     false,
        onDrilldown: null,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.state = useState({
            expanded: false,
        });
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Total damage value formatted.
     * @returns {string}
     */
    get totalValueLabel() {
        const val = this.props.data?.total_value || 0;
        return this.formatCurrency(val);
    }

    /**
     * Total scrap count.
     * @returns {number}
     */
    get totalCount() {
        return this.props.data?.total_count || 0;
    }

    /**
     * Reasons breakdown list.
     * @returns {Array}
     */
    get reasonsList() {
        const reasons = this.props.data?.by_reason || [];
        return this.state.expanded ? reasons : reasons.slice(0, 4);
    }

    /**
     * Whether expand button should be shown.
     * @returns {boolean}
     */
    get hasMoreReasons() {
        const total = (this.props.data?.by_reason || []).length;
        return !this.state.expanded && total > 4;
    }

    /**
     * Remaining reasons count.
     * @returns {number}
     */
    get remainingReasons() {
        return (this.props.data?.by_reason || []).length - 4;
    }

    /**
     * Max reason value for bar scaling.
     * @returns {number}
     */
    get maxReasonValue() {
        const reasons = this.props.data?.by_reason || [];
        return Math.max(...reasons.map(r => r.value || 0), 1);
    }

    /**
     * Whether there is any damage data.
     * @returns {boolean}
     */
    get hasData() {
        return this.totalCount > 0;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Format currency value.
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
     * Bar width for reason row.
     * @param {number} value
     * @returns {string}
     */
    getBarWidth(value) {
        const pct = this.maxReasonValue > 0
            ? (value / this.maxReasonValue) * 100
            : 0;
        return `${Math.max(2, pct).toFixed(1)}%`;
    }

    /**
     * Color for reason bar.
     * @param {number} index
     * @returns {string}
     */
    getBarColor(index) {
        const colors = [
            '#dc3545',
            '#fd7e14',
            '#ffc107',
            '#0dcaf0',
            '#6f42c1',
            '#20c997',
            '#0d6efd',
            '#6c757d',
        ];
        return colors[index % colors.length];
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    toggleExpand() {
        this.state.expanded = !this.state.expanded;
    }

    onWidgetClick() {
        if (this.props.onDrilldown) {
            this.props.onDrilldown('damage', null);
        }
    }
}