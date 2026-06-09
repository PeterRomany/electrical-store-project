/** @odoo-module **/

import { Component } from "@odoo/owl";

// =============================================================================
// KpiCard Component
// Displays a single KPI metric with value, label, trend, and icon
// =============================================================================

export class KpiCard extends Component {
    static template = "profit_dashboard.KpiCard";

    static props = {
        label:       { type: String },
        labelAr:     { type: String, optional: true },
        value:       { type: [String, Number] },
        subValue:    { type: String, optional: true },
        icon:        { type: String, optional: true },
        colorClass:  { type: String, optional: true },
        trendValue:  { type: Number, optional: true },
        trendLabel:  { type: String, optional: true },
        onClick:     { type: Function, optional: true },
        loading:     { type: Boolean, optional: true },
        prefix:      { type: String, optional: true },
        suffix:      { type: String, optional: true },
    };

    static defaultProps = {
        labelAr:    '',
        icon:       'fa-chart-bar',
        colorClass: 'kpi-primary',
        trendValue: null,
        trendLabel: '',
        onClick:    null,
        loading:    false,
        prefix:     '',
        suffix:     '',
    };

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Formatted display value.
     * @returns {string}
     */
    get displayValue() {
        if (this.props.loading) return '...';
        const val = this.props.value;
        if (val === null || val === undefined) return '—';
        return `${this.props.prefix}${val}${this.props.suffix}`;
    }

    /**
     * Trend CSS class.
     * @returns {string}
     */
    get trendClass() {
        const trend = this.props.trendValue;
        if (trend === null || trend === undefined) return '';
        if (trend > 0)  return 'kpi-trend trend-up';
        if (trend < 0)  return 'kpi-trend trend-down';
        return 'kpi-trend trend-neutral';
    }

    /**
     * Trend icon.
     * @returns {string}
     */
    get trendIcon() {
        const trend = this.props.trendValue;
        if (trend === null || trend === undefined) return '';
        if (trend > 0) return '↑';
        if (trend < 0) return '↓';
        return '→';
    }

    /**
     * Formatted trend value string.
     * @returns {string}
     */
    get trendDisplay() {
        const trend = this.props.trendValue;
        if (trend === null || trend === undefined) return '';
        const sign = trend > 0 ? '+' : '';
        return `${sign}${trend.toFixed(1)}٪`;
    }

    /**
     * Whether trend should be shown.
     * @returns {boolean}
     */
    get hasTrend() {
        return this.props.trendValue !== null &&
               this.props.trendValue !== undefined;
    }

    /**
     * Card CSS class string.
     * @returns {string}
     */
    get cardClass() {
        const base     = 'kpi-card';
        const color    = this.props.colorClass || 'kpi-primary';
        const clickable = this.props.onClick ? 'kpi-clickable' : '';
        return [base, color, clickable].filter(Boolean).join(' ');
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    onCardClick() {
        if (this.props.onClick) {
            this.props.onClick();
        }
    }
}