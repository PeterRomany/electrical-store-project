/** @odoo-module **/

import { Component, useState, onMounted, onWillUpdateProps, useRef } from "@odoo/owl";

// =============================================================================
// SalesChart Component
// Renders monthly sales trend as a bar chart using pure CSS/SVG
// No external chart library required
// =============================================================================

export class SalesChart extends Component {
    static template = "profit_dashboard.SalesChart";

    static props = {
        data:    { type: Array },
        loading: { type: Boolean, optional: true },
        height:  { type: Number, optional: true },
    };

    static defaultProps = {
        loading: false,
        height:  200,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.state = useState({
            hoveredIndex: null,
            tooltip:      null,
        });
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Maximum sales value across all months (for bar scaling).
     * @returns {number}
     */
    get maxValue() {
        if (!this.props.data || this.props.data.length === 0) return 1;
        return Math.max(...this.props.data.map(d => d.sales || 0), 1);
    }

    /**
     * Compute bar height percentage for each data point.
     * @returns {Array}
     */
    get chartBars() {
        if (!this.props.data || this.props.data.length === 0) return [];

        const maxVal = this.maxValue;

        return this.props.data.map((item, index) => {
            const heightPct = maxVal > 0
                ? Math.max(2, (item.sales / maxVal) * 100)
                : 2;

            return {
                ...item,
                index,
                heightPct:  heightPct.toFixed(1),
                formattedValue: this._formatShort(item.sales),
                isHovered:  this.state.hoveredIndex === index,
                isCurrent:  item.is_current || false,
            };
        });
    }

    /**
     * Y-axis labels (0, 25%, 50%, 75%, 100% of max).
     * @returns {Array}
     */
    get yAxisLabels() {
        const max = this.maxValue;
        return [
            { pct: 100, label: this._formatShort(max) },
            { pct: 75,  label: this._formatShort(max * 0.75) },
            { pct: 50,  label: this._formatShort(max * 0.5) },
            { pct: 25,  label: this._formatShort(max * 0.25) },
            { pct: 0,   label: '0' },
        ];
    }

    /**
     * Total value across all months.
     * @returns {number}
     */
    get totalValue() {
        if (!this.props.data) return 0;
        return this.props.data.reduce((sum, d) => sum + (d.sales || 0), 0);
    }

    /**
     * Average monthly value.
     * @returns {string}
     */
    get averageLabel() {
        if (!this.props.data || this.props.data.length === 0) return '0';
        const avg = this.totalValue / this.props.data.length;
        return this._formatShort(avg);
    }

    // -------------------------------------------------------------------------
    // Event Handlers
    // -------------------------------------------------------------------------

    onBarHover(index) {
        this.state.hoveredIndex = index;
    }

    onBarLeave() {
        this.state.hoveredIndex = null;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Format number as short string (K, M).
     * @param {number} value
     * @returns {string}
     */
    _formatShort(value) {
        if (!value || value === 0) return '0';
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
        return value.toFixed(0);
    }

    /**
     * Format full currency value.
     * @param {number} value
     * @returns {string}
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value || 0) + ' ج.م';
    }
}