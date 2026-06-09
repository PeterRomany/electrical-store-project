/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

// =============================================================================
// Profit Dashboard Service
// Provides centralized data fetching and caching for the dashboard
// =============================================================================

export class ProfitDashboardService {

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(env, services) {
        this.env    = env;
        this.rpc    = services.rpc;
        this.orm    = services.orm;
        this.user   = services.user;

        // Cache
        this._cache     = null;
        this._cacheTime = null;
        this._cacheTTL  = 5 * 60 * 1000; // 5 minutes
    }

    // -------------------------------------------------------------------------
    // Main Data Fetcher
    // -------------------------------------------------------------------------

    /**
     * Fetch all dashboard data from server.
     * Uses cache if data is fresh (within TTL).
     *
     * @param {string|null} dateFrom — ISO date string
     * @param {string|null} dateTo   — ISO date string
     * @param {boolean}     force    — bypass cache
     * @returns {Promise<object>}
     */
    async getDashboardData(dateFrom = null, dateTo = null, force = false) {
        const now = Date.now();

        // Return cached data if fresh
        if (
            !force &&
            this._cache &&
            this._cacheTime &&
            (now - this._cacheTime) < this._cacheTTL
        ) {
            return this._cache;
        }

        try {
            const data = await this.rpc(
                '/profit_dashboard/data',
                {
                    date_from: dateFrom,
                    date_to:   dateTo,
                },
            );

            this._cache     = data;
            this._cacheTime = now;

            return data;

        } catch (error) {
            console.error('[ProfitDashboard] Failed to fetch data:', error);
            throw error;
        }
    }

    /**
     * Fetch only KPI data (lightweight).
     *
     * @param {string|null} dateFrom
     * @param {string|null} dateTo
     * @returns {Promise<object>}
     */
    async getKpis(dateFrom = null, dateTo = null) {
        return this.rpc('/profit_dashboard/kpis', {
            date_from: dateFrom,
            date_to:   dateTo,
        });
    }

    /**
     * Fetch low stock alerts.
     *
     * @param {number} threshold
     * @param {number} limit
     * @returns {Promise<Array>}
     */
    async getLowStock(threshold = 10, limit = 20) {
        return this.rpc('/profit_dashboard/low_stock', {
            threshold,
            limit,
        });
    }

    /**
     * Fetch monthly trend data.
     *
     * @param {number} months
     * @returns {Promise<Array>}
     */
    async getMonthlyTrend(months = 6) {
        return this.rpc('/profit_dashboard/monthly_trend', { months });
    }

    /**
     * Fetch top products.
     *
     * @param {string|null} dateFrom
     * @param {string|null} dateTo
     * @param {number}      limit
     * @returns {Promise<Array>}
     */
    async getTopProducts(dateFrom = null, dateTo = null, limit = 10) {
        return this.rpc('/profit_dashboard/top_products', {
            date_from: dateFrom,
            date_to:   dateTo,
            limit,
        });
    }

    /**
     * Fetch top customers.
     *
     * @param {string|null} dateFrom
     * @param {string|null} dateTo
     * @param {number}      limit
     * @returns {Promise<Array>}
     */
    async getTopCustomers(dateFrom = null, dateTo = null, limit = 10) {
        return this.rpc('/profit_dashboard/top_customers', {
            date_from: dateFrom,
            date_to:   dateTo,
            limit,
        });
    }

    /**
     * Fetch damage summary.
     *
     * @param {string|null} dateFrom
     * @param {string|null} dateTo
     * @returns {Promise<object>}
     */
    async getDamageSummary(dateFrom = null, dateTo = null) {
        return this.rpc('/profit_dashboard/damage', {
            date_from: dateFrom,
            date_to:   dateTo,
        });
    }

    // -------------------------------------------------------------------------
    // Formatting Helpers
    // -------------------------------------------------------------------------

    /**
     * Format a number as currency string (EGP).
     *
     * @param {number} amount
     * @param {boolean} short — use abbreviated format (K, M)
     * @returns {string}
     */
    formatCurrency(amount, short = false) {
        if (amount === null || amount === undefined) return '—';

        if (short) {
            if (amount >= 1_000_000) {
                return `${(amount / 1_000_000).toFixed(1)}M ج.م`;
            }
            if (amount >= 1_000) {
                return `${(amount / 1_000).toFixed(1)}K ج.م`;
            }
        }

        return new Intl.NumberFormat('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount) + ' ج.م';
    }

    /**
     * Format a percentage.
     *
     * @param {number} pct
     * @returns {string}
     */
    formatPct(pct) {
        if (pct === null || pct === undefined) return '—';
        const sign = pct > 0 ? '+' : '';
        return `${sign}${pct.toFixed(1)}٪`;
    }

    /**
     * Get trend class based on value change.
     *
     * @param {number} current
     * @param {number} previous
     * @returns {string} — 'trend-up' | 'trend-down' | 'trend-neutral'
     */
    getTrendClass(current, previous) {
        if (!previous || previous === 0) return 'trend-neutral';
        if (current > previous)  return 'trend-up';
        if (current < previous)  return 'trend-down';
        return 'trend-neutral';
    }

    /**
     * Get trend icon based on direction.
     *
     * @param {string} trendClass
     * @returns {string}
     */
    getTrendIcon(trendClass) {
        const icons = {
            'trend-up':      '↑',
            'trend-down':    '↓',
            'trend-neutral': '→',
        };
        return icons[trendClass] || '→';
    }

    /**
     * Get Arabic label for customer type.
     *
     * @param {string} type
     * @returns {string}
     */
    getCustomerTypeLabel(type) {
        const labels = {
            retail:      'تجزئة',
            electrician: 'كهربائي',
            contractor:  'مقاول',
            company:     'شركة',
            unknown:     'غير محدد',
        };
        return labels[type] || type;
    }

    /**
     * Invalidate cache (force next fetch from server).
     */
    invalidateCache() {
        this._cache     = null;
        this._cacheTime = null;
    }
}

// -------------------------------------------------------------------------
// Service Registration
// -------------------------------------------------------------------------

registry.category('services').add('profit_dashboard', {
    dependencies: ['rpc', 'orm', 'user'],
    start(env, services) {
        return new ProfitDashboardService(env, services);
    },
});