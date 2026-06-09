# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request
from odoo.exceptions import AccessError


class ProfitDashboardController(http.Controller):
    """
    Profit Dashboard JSON Controller
    ==================================
    Provides RPC endpoints consumed by the OWL dashboard component.
    All endpoints require authentication and manager/accountant group.
    """

    # -------------------------------------------------------------------------
    # Main Dashboard Data
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/data',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_dashboard_data(self, date_from=None, date_to=None, **kwargs):
        """
        Main dashboard data endpoint.
        Returns all KPIs, charts, and widget data.

        :param date_from: str — ISO date (optional)
        :param date_to:   str — ISO date (optional)
        :returns: dict — full dashboard data
        """
        self._check_access()

        return request.env['profit.dashboard'].get_dashboard_data(
            date_from=date_from,
            date_to=date_to,
        )

    # -------------------------------------------------------------------------
    # KPIs Only (for quick refresh)
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/kpis',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_kpis(self, date_from=None, date_to=None, **kwargs):
        """
        Returns only KPI data for lightweight refresh.
        """
        self._check_access()

        from datetime import date
        today       = date.today()
        period_from = (
            date.fromisoformat(date_from)
            if date_from
            else today.replace(day=1)
        )
        period_to = (
            date.fromisoformat(date_to)
            if date_to
            else today
        )

        dashboard = request.env['profit.dashboard']
        return dashboard._get_kpis(today, period_from, period_to)

    # -------------------------------------------------------------------------
    # Low Stock (for alerts widget)
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/low_stock',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_low_stock(self, threshold=10, limit=20, **kwargs):
        """
        Returns low stock alerts.
        """
        self._check_access()

        return request.env['profit.dashboard']._get_low_stock_alerts(
            threshold=int(threshold),
            limit=int(limit),
        )

    # -------------------------------------------------------------------------
    # Monthly Trend (for chart)
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/monthly_trend',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_monthly_trend(self, months=6, **kwargs):
        """
        Returns monthly sales trend data for chart.
        """
        self._check_access()

        return request.env['profit.dashboard']._get_monthly_trend(
            months=int(months),
        )

    # -------------------------------------------------------------------------
    # Top Products
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/top_products',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_top_products(self, date_from=None, date_to=None,
                         limit=10, **kwargs):
        """
        Returns top products by revenue.
        """
        self._check_access()

        from datetime import date
        today       = date.today()
        period_from = (
            date.fromisoformat(date_from)
            if date_from
            else today.replace(day=1)
        )
        period_to = (
            date.fromisoformat(date_to)
            if date_to
            else today
        )

        return request.env['profit.dashboard']._get_top_products(
            period_from,
            period_to,
            limit=int(limit),
        )

    # -------------------------------------------------------------------------
    # Top Customers
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/top_customers',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_top_customers(self, date_from=None, date_to=None,
                          limit=10, **kwargs):
        """
        Returns top customers by revenue.
        """
        self._check_access()

        from datetime import date
        today       = date.today()
        period_from = (
            date.fromisoformat(date_from)
            if date_from
            else today.replace(day=1)
        )
        period_to = (
            date.fromisoformat(date_to)
            if date_to
            else today
        )

        return request.env['profit.dashboard']._get_top_customers(
            period_from,
            period_to,
            limit=int(limit),
        )

    # -------------------------------------------------------------------------
    # Damage Summary
    # -------------------------------------------------------------------------

    @http.route(
        '/profit_dashboard/damage',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=True,
    )
    def get_damage_summary(self, date_from=None, date_to=None, **kwargs):
        """
        Returns damage summary for the period.
        """
        self._check_access()

        from datetime import date
        today       = date.today()
        period_from = (
            date.fromisoformat(date_from)
            if date_from
            else today.replace(day=1)
        )
        period_to = (
            date.fromisoformat(date_to)
            if date_to
            else today
        )

        return request.env['profit.dashboard']._get_damage_summary(
            period_from,
            period_to,
        )

    # -------------------------------------------------------------------------
    # Access Control
    # -------------------------------------------------------------------------

    def _check_access(self):
        """
        Verify the current user has access to the dashboard.
        Must be in manager or accountant group.
        Raises AccessError if not authorized.
        """
        user = request.env.user
        is_manager    = user.has_group(
            'electrical_store_base.group_electrical_manager'
        )
        is_accountant = user.has_group(
            'electrical_store_base.group_electrical_accountant'
        )
        is_storekeeper = user.has_group(
            'electrical_store_base.group_electrical_storekeeper'
        )

        if not (is_manager or is_accountant or is_storekeeper):
            raise AccessError(
                'Access denied: Dashboard requires Manager, '
                'Accountant, or Store Keeper role.\n'
                'تم رفض الوصول: لوحة التحكم تتطلب صلاحية المدير '
                'أو المحاسب أو أمين المخزن.'
            )