/** @odoo-module **/

import { Component, useState, onWillStart, onWillUnmount, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";

// Components
import { KpiCard }            from "@profit_dashboard/js/components/KpiCard/KpiCard";
import { SalesChart }         from "@profit_dashboard/js/components/SalesChart/SalesChart";
import { TopProductsTable }   from "@profit_dashboard/js/components/TopProductsTable/TopProductsTable";
import { TopCustomersTable }  from "@profit_dashboard/js/components/TopCustomersTable/TopCustomersTable";
import { LowStockAlert }      from "@profit_dashboard/js/components/LowStockAlert/LowStockAlert";
import { DamageWidget }       from "@profit_dashboard/js/components/DamageWidget/DamageWidget";

// =============================================================================
// ProfitDashboard — Main OWL Client Action Component
// Registers as 'profit_dashboard' client action tag
// =============================================================================

export class ProfitDashboard extends Component {
    static template = "profit_dashboard.ProfitDashboard";

    static components = {
        KpiCard,
        SalesChart,
        TopProductsTable,
        TopCustomersTable,
        LowStockAlert,
        DamageWidget,
    };

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        this.rpc          = useService("rpc");
        this.action       = useService("action");
        this.notification = useService("notification");

        // Today's date in ISO format
        const today      = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        this.state = useState({
            loading:    true,
            error:      null,
            data:       null,
            dateFrom:   this._toISODate(monthStart),
            dateTo:     this._toISODate(today),
            lastRefresh: null,
            refreshing:  false,
        });

        // Auto-refresh interval (5 minutes)
        this._refreshInterval = null;

        onWillStart(async () => {
            await this._loadData();
        });

        onWillUnmount(() => {
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
            }
        });

        // Start auto-refresh after initial load
        this._startAutoRefresh();
    }

    // -------------------------------------------------------------------------
    // Data Loading
    // -------------------------------------------------------------------------

    /**
     * Load all dashboard data from server.
     * @param {boolean} silent — if true, show refreshing state not loading
     */
    async _loadData(silent = false) {
        if (silent) {
            this.state.refreshing = true;
        } else {
            this.state.loading = true;
            this.state.error   = null;
        }

        try {
            const data = await this.rpc('/profit_dashboard/data', {
                date_from: this.state.dateFrom,
                date_to:   this.state.dateTo,
            });

            this.state.data        = data;
            this.state.lastRefresh = new Date().toLocaleTimeString('ar-EG');
            this.state.error       = null;

        } catch (err) {
            console.error('[ProfitDashboard] Load error:', err);
            this.state.error = (
                err.message ||
                'تعذر تحميل بيانات لوحة التحكم. تحقق من الاتصال.'
            );
        } finally {
            this.state.loading    = false;
            this.state.refreshing = false;
        }
    }

    /**
     * Start auto-refresh every 5 minutes.
     */
    _startAutoRefresh() {
        this._refreshInterval = setInterval(async () => {
            await this._loadData(true);
        }, 5 * 60 * 1000);
    }

    // -------------------------------------------------------------------------
    // User Actions
    // -------------------------------------------------------------------------

    /**
     * Handle date range change and reload.
     */
    async onDateChange() {
        await this._loadData(false);
    }

    /**
     * Manual refresh button.
     */
    async onRefresh() {
        await this._loadData(true);
    }

    /**
     * Handle drill-down clicks from child components.
     * Navigates to relevant Odoo list/form view.
     *
     * @param {string} type   — 'product' | 'customer' | 'damage' | 'pos'
     * @param {number|null} id
     */
    async onDrilldown(type, id) {
        const actions = {
            product: {
                type:      'ir.actions.act_window',
                res_model: 'product.template',
                view_mode: 'list,form',
                name:      'المنتجات / Products',
            },
            customer: {
                type:      'ir.actions.act_window',
                res_model: 'res.partner',
                view_mode: 'list,form',
                domain:    [['customer_rank', '>', 0]],
                name:      'العملاء / Customers',
            },
            damage: {
                type:      'ir.actions.act_window',
                res_model: 'stock.scrap',
                view_mode: 'list,form,graph',
                domain:    [['state', '=', 'done']],
                name:      'التلف والإتلاف / Damage',
            },
            pos: {
                type:      'ir.actions.act_window',
                res_model: 'pos.order',
                view_mode: 'list,form',
                name:      'طلبات نقطة البيع / POS Orders',
            },
        };

        const actionDef = actions[type];
        if (!actionDef) return;

        if (id) {
            actionDef.res_id    = id;
            actionDef.view_mode = 'form,list';
        }

        await this.action.doAction(actionDef);
    }

    // -------------------------------------------------------------------------
    // Date Helpers
    // -------------------------------------------------------------------------

    onDateFromChange(ev) {
        this.state.dateFrom = ev.target.value;
    }

    onDateToChange(ev) {
        this.state.dateTo = ev.target.value;
    }

    _toISODate(date) {
        return date.toISOString().split('T')[0];
    }

    // -------------------------------------------------------------------------
    // Quick Period Selectors
    // -------------------------------------------------------------------------

    async setToday() {
        const today = this._toISODate(new Date());
        this.state.dateFrom = today;
        this.state.dateTo   = today;
        await this._loadData();
    }

    async setThisMonth() {
        const today      = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.state.dateFrom = this._toISODate(monthStart);
        this.state.dateTo   = this._toISODate(today);
        await this._loadData();
    }

    async setThisYear() {
        const today     = new Date();
        const yearStart = new Date(today.getFullYear(), 0, 1);
        this.state.dateFrom = this._toISODate(yearStart);
        this.state.dateTo   = this._toISODate(today);
        await this._loadData();
    }

    async setLast30Days() {
        const today   = new Date();
        const from    = new Date(today);
        from.setDate(from.getDate() - 30);
        this.state.dateFrom = this._toISODate(from);
        this.state.dateTo   = this._toISODate(today);
        await this._loadData();
    }

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    get kpis() {
        return this.state.data?.kpis || {};
    }

    get topProducts() {
        return this.state.data?.top_products || [];
    }

    get topCustomers() {
        return this.state.data?.top_customers || [];
    }

    get lowStockItems() {
        return this.state.data?.low_stock || [];
    }

    get damageData() {
        return this.state.data?.damage || null;
    }

    get monthlyTrend() {
        return this.state.data?.monthly_trend || [];
    }

    get byCustomerType() {
        return this.state.data?.by_customer_type || [];
    }

    get posSummary() {
        return this.state.data?.pos_summary || {};
    }

    get periodLabel() {
        const data = this.state.data?.period;
        if (!data) return '';
        return `${data.date_from} — ${data.date_to}`;
    }

    /**
     * Format currency for KPI display.
     * @param {number} value
     * @returns {string}
     */
    formatCurrency(value) {
        if (!value && value !== 0) return '0';
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
        return value.toFixed(0);
    }

    /**
     * Format currency with EGP suffix.
     * @param {number} value
     * @returns {string}
     */
    formatCurrencyFull(value) {
        return this.formatCurrency(value) + ' ج.م';
    }

    /**
     * Max bar width for customer type bars.
     * @returns {number}
     */
    get maxCustomerTypeRevenue() {
        return Math.max(
            ...this.byCustomerType.map(t => t.revenue || 0), 1
        );
    }

    /**
     * Get bar width for customer type.
     * @param {number} revenue
     * @returns {string}
     */
    getTypeBarWidth(revenue) {
        const pct = this.maxCustomerTypeRevenue > 0
            ? (revenue / this.maxCustomerTypeRevenue) * 100
            : 0;
        return `${Math.max(2, pct).toFixed(1)}%`;
    }
}

// -------------------------------------------------------------------------
// Register as Client Action
// -------------------------------------------------------------------------

registry.category("actions").add("profit_dashboard", ProfitDashboard);