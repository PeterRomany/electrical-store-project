# -*- coding: utf-8 -*-
from odoo import api, fields, models
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


class ProfitDashboard(models.AbstractModel):
    """
    Profit Dashboard Data Provider
    ================================
    Abstract model providing all data computation methods
    for the dashboard. No persistent storage — all computed
    on-demand from existing transactional data.
    """
    _name        = 'profit.dashboard'
    _description = 'Profit Dashboard / لوحة الربحية'

    # -------------------------------------------------------------------------
    # Main Data Entry Point
    # -------------------------------------------------------------------------

    @api.model
    def get_dashboard_data(self, date_from=None, date_to=None):
        """
        Main RPC method called by OWL dashboard component.
        Returns all dashboard data in a single call.

        :param date_from: str — ISO date string (optional, defaults to month start)
        :param date_to:   str — ISO date string (optional, defaults to today)
        :returns: dict with all dashboard sections
        """
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

        return {
            'period': {
                'date_from':    str(period_from),
                'date_to':      str(period_to),
                'today':        str(today),
                'month_name':   today.strftime('%B %Y'),
            },
            'kpis':             self._get_kpis(today, period_from, period_to),
            'top_products':     self._get_top_products(period_from, period_to),
            'top_customers':    self._get_top_customers(period_from, period_to),
            'low_stock':        self._get_low_stock_alerts(),
            'damage':           self._get_damage_summary(period_from, period_to),
            'monthly_trend':    self._get_monthly_trend(6),
            'by_customer_type': self._get_sales_by_customer_type(
                period_from, period_to
            ),
            'pos_summary':      self._get_pos_summary(today),
        }

    # -------------------------------------------------------------------------
    # KPIs
    # -------------------------------------------------------------------------

    @api.model
    def _get_kpis(self, today, period_from, period_to):
        """
        Compute key performance indicators.
        Returns daily sales, period sales, gross profit, and purchase costs.
        """
        # ---- Daily Sales (today) ----
        daily_sales = self._get_sales_total(today, today)

        # ---- Period Sales ----
        period_sales = self._get_sales_total(period_from, period_to)

        # ---- Previous Period (for comparison) ----
        days_diff   = (period_to - period_from).days + 1
        prev_to     = period_from - timedelta(days=1)
        prev_from   = prev_to - timedelta(days=days_diff - 1)
        prev_sales  = self._get_sales_total(prev_from, prev_to)

        # ---- Sales Growth % ----
        if prev_sales > 0:
            growth_pct = ((period_sales - prev_sales) / prev_sales) * 100
        else:
            growth_pct = 100.0 if period_sales > 0 else 0.0

        # ---- Gross Profit ----
        gross_profit, gross_profit_pct = self._get_gross_profit(
            period_from, period_to
        )

        # ---- Order Count ----
        so_count  = self._get_sale_order_count(period_from, period_to)
        pos_count = self._get_pos_order_count(period_from, period_to)

        # ---- Purchase Cost ----
        purchase_cost = self._get_purchase_cost(period_from, period_to)

        return {
            'daily_sales':       daily_sales,
            'period_sales':      period_sales,
            'prev_period_sales': prev_sales,
            'growth_pct':        round(growth_pct, 1),
            'gross_profit':      gross_profit,
            'gross_profit_pct':  round(gross_profit_pct, 1),
            'so_count':          so_count,
            'pos_count':         pos_count,
            'total_orders':      so_count + pos_count,
            'purchase_cost':     purchase_cost,
        }

    # -------------------------------------------------------------------------
    # Sales Helpers
    # -------------------------------------------------------------------------

    @api.model
    def _get_sales_total(self, date_from, date_to):
        """Sum of confirmed sale orders + POS orders in period."""
        # Sale Orders
        so_total = sum(
            self.env['sale.order'].search([
                ('state',          'in',  ('sale', 'done')),
                ('date_order',     '>=',  f'{date_from} 00:00:00'),
                ('date_order',     '<=',  f'{date_to} 23:59:59'),
            ]).mapped('amount_total')
        )

        # POS Orders
        pos_total = sum(
            self.env['pos.order'].search([
                ('state',          'in',  ('paid', 'done', 'invoiced')),
                ('date_order',     '>=',  f'{date_from} 00:00:00'),
                ('date_order',     '<=',  f'{date_to} 23:59:59'),
            ]).mapped('amount_total')
        )

        return round(so_total + pos_total, 2)

    @api.model
    def _get_sale_order_count(self, date_from, date_to):
        return self.env['sale.order'].search_count([
            ('state',      'in', ('sale', 'done')),
            ('date_order', '>=', f'{date_from} 00:00:00'),
            ('date_order', '<=', f'{date_to} 23:59:59'),
        ])

    @api.model
    def _get_pos_order_count(self, date_from, date_to):
        return self.env['pos.order'].search_count([
            ('state',      'in', ('paid', 'done', 'invoiced')),
            ('date_order', '>=', f'{date_from} 00:00:00'),
            ('date_order', '<=', f'{date_to} 23:59:59'),
        ])

    @api.model
    def _get_purchase_cost(self, date_from, date_to):
        """Sum of validated purchase order totals in period."""
        return sum(
            self.env['purchase.order'].search([
                ('state',         'in', ('purchase', 'done')),
                ('date_approve',  '>=', f'{date_from} 00:00:00'),
                ('date_approve',  '<=', f'{date_to} 23:59:59'),
            ]).mapped('amount_total')
        )

    # -------------------------------------------------------------------------
    # Gross Profit
    # -------------------------------------------------------------------------

    @api.model
    def _get_gross_profit(self, date_from, date_to):
        """
        Calculate gross profit from sale order lines.
        Gross Profit = Revenue - (Qty * Standard Cost)
        """
        so_lines = self.env['sale.order.line'].search([
            ('order_id.state',        'in', ('sale', 'done')),
            ('order_id.date_order',   '>=', f'{date_from} 00:00:00'),
            ('order_id.date_order',   '<=', f'{date_to} 23:59:59'),
        ])

        revenue = 0.0
        cost    = 0.0

        for line in so_lines:
            line_revenue  = line.price_subtotal
            line_cost     = (
                line.product_id.standard_price * line.product_uom_qty
            )
            revenue += line_revenue
            cost    += line_cost

        # POS lines
        pos_lines = self.env['pos.order.line'].search([
            ('order_id.state',      'in', ('paid', 'done', 'invoiced')),
            ('order_id.date_order', '>=', f'{date_from} 00:00:00'),
            ('order_id.date_order', '<=', f'{date_to} 23:59:59'),
        ])

        for line in pos_lines:
            line_revenue = line.price_subtotal_incl
            line_cost    = (
                line.product_id.standard_price * line.qty
            )
            revenue += line_revenue
            cost    += line_cost

        gross_profit = revenue - cost
        gross_pct    = (gross_profit / revenue * 100) if revenue > 0 else 0.0

        return round(gross_profit, 2), round(gross_pct, 1)

    # -------------------------------------------------------------------------
    # Top Products
    # -------------------------------------------------------------------------

    @api.model
    def _get_top_products(self, date_from, date_to, limit=10):
        """
        Top selling products by revenue in the period.
        Combines SO lines and POS lines.
        """
        product_data = {}

        # From Sale Orders
        so_lines = self.env['sale.order.line'].search([
            ('order_id.state',      'in', ('sale', 'done')),
            ('order_id.date_order', '>=', f'{date_from} 00:00:00'),
            ('order_id.date_order', '<=', f'{date_to} 23:59:59'),
        ])

        for line in so_lines:
            pid = line.product_id.id
            if pid not in product_data:
                product_data[pid] = {
                    'id':       pid,
                    'name':     line.product_id.display_name or '',
                    'brand':    line.product_id.brand_id.name
                                if line.product_id.brand_id else '',
                    'category': line.product_id.categ_id.name or '',
                    'revenue':  0.0,
                    'qty':      0.0,
                    'cost':     0.0,
                }
            product_data[pid]['revenue'] += line.price_subtotal
            product_data[pid]['qty']     += line.product_uom_qty
            product_data[pid]['cost']    += (
                line.product_id.standard_price * line.product_uom_qty
            )

        # From POS Orders
        pos_lines = self.env['pos.order.line'].search([
            ('order_id.state',      'in', ('paid', 'done', 'invoiced')),
            ('order_id.date_order', '>=', f'{date_from} 00:00:00'),
            ('order_id.date_order', '<=', f'{date_to} 23:59:59'),
        ])

        for line in pos_lines:
            pid = line.product_id.id
            if pid not in product_data:
                product_data[pid] = {
                    'id':       pid,
                    'name':     line.product_id.display_name or '',
                    'brand':    line.product_id.brand_id.name
                                if line.product_id.brand_id else '',
                    'category': line.product_id.categ_id.name or '',
                    'revenue':  0.0,
                    'qty':      0.0,
                    'cost':     0.0,
                }
            product_data[pid]['revenue'] += line.price_subtotal_incl
            product_data[pid]['qty']     += line.qty
            product_data[pid]['cost']    += (
                line.product_id.standard_price * line.qty
            )

        # Add profit margin
        for pid, data in product_data.items():
            revenue = data['revenue']
            cost    = data['cost']
            data['profit']     = round(revenue - cost, 2)
            data['margin_pct'] = round(
                ((revenue - cost) / revenue * 100) if revenue > 0 else 0.0,
                1,
            )
            data['revenue'] = round(revenue, 2)
            data['qty']     = round(data['qty'], 2)

        # Sort by revenue descending, return top N
        sorted_products = sorted(
            product_data.values(),
            key=lambda x: x['revenue'],
            reverse=True,
        )

        return sorted_products[:limit]

    # -------------------------------------------------------------------------
    # Top Customers
    # -------------------------------------------------------------------------

    @api.model
    def _get_top_customers(self, date_from, date_to, limit=10):
        """
        Top customers by revenue in the period.
        Combines SO and POS orders.
        """
        customer_data = {}

        # From Sale Orders
        orders = self.env['sale.order'].search([
            ('state',          'in', ('sale', 'done')),
            ('date_order',     '>=', f'{date_from} 00:00:00'),
            ('date_order',     '<=', f'{date_to} 23:59:59'),
            ('partner_id',     '!=', False),
        ])

        for order in orders:
            pid = order.partner_id.commercial_partner_id.id
            if pid not in customer_data:
                partner = order.partner_id.commercial_partner_id
                customer_data[pid] = {
                    'id':            pid,
                    'name':          partner.name or '',
                    'customer_type': partner.customer_type or 'retail',
                    'phone':         partner.phone or '',
                    'revenue':       0.0,
                    'order_count':   0,
                }
            customer_data[pid]['revenue']     += order.amount_total
            customer_data[pid]['order_count'] += 1

        # From POS Orders
        pos_orders = self.env['pos.order'].search([
            ('state',      'in', ('paid', 'done', 'invoiced')),
            ('date_order', '>=', f'{date_from} 00:00:00'),
            ('date_order', '<=', f'{date_to} 23:59:59'),
            ('partner_id', '!=', False),
        ])

        for order in pos_orders:
            pid = order.partner_id.commercial_partner_id.id
            if pid not in customer_data:
                partner = order.partner_id.commercial_partner_id
                customer_data[pid] = {
                    'id':            pid,
                    'name':          partner.name or '',
                    'customer_type': partner.customer_type or 'retail',
                    'phone':         partner.phone or '',
                    'revenue':       0.0,
                    'order_count':   0,
                }
            customer_data[pid]['revenue']     += order.amount_total
            customer_data[pid]['order_count'] += 1

        # Round revenue
        for pid in customer_data:
            customer_data[pid]['revenue'] = round(
                customer_data[pid]['revenue'], 2
            )

        # Sort and return top N
        return sorted(
            customer_data.values(),
            key=lambda x: x['revenue'],
            reverse=True,
        )[:limit]

    # -------------------------------------------------------------------------
    # Low Stock Alerts
    # -------------------------------------------------------------------------

    @api.model
    def _get_low_stock_alerts(self, threshold=10, limit=20):
        """
        Products with quantity at or below threshold.
        Returns list sorted by qty ascending.
        """
        products = self.env['product.product'].search([
            ('type',           '=',  'consu'),
            ('active',         '=',  True),
            ('qty_available',  '<=', threshold),
        ], limit=limit * 2)

        # Filter to storable products
        alerts = []
        for product in products:
            if product.type not in ('consu', 'product'):
                continue
            alerts.append({
                'id':             product.id,
                'name':           product.display_name or '',
                'default_code':   product.default_code or '',
                'brand':          product.brand_id.name
                                  if product.brand_id else '',
                'shelf':          product.shelf_location or '',
                'qty_available':  round(product.qty_available, 2),
                'uom':            product.uom_id.name or '',
                'category':       product.categ_id.name or '',
                'is_zero':        product.qty_available <= 0,
                'is_low':         0 < product.qty_available <= threshold,
            })

        # Sort: zero first, then by qty ascending
        alerts.sort(key=lambda x: (not x['is_zero'], x['qty_available']))

        return alerts[:limit]

    # -------------------------------------------------------------------------
    # Damage Summary
    # -------------------------------------------------------------------------

    @api.model
    def _get_damage_summary(self, date_from, date_to):
        """Damage statistics for the period."""
        scraps = self.env['stock.scrap'].search([
            ('state',     '=',  'done'),
            ('date_done', '>=', f'{date_from} 00:00:00'),
            ('date_done', '<=', f'{date_to} 23:59:59'),
        ])

        total_value  = sum(s.damage_value for s in scraps)
        total_count  = len(scraps)

        # By reason
        by_reason = {}
        for scrap in scraps:
            rname = (
                scrap.damage_reason_id.name_arabic
                or scrap.damage_reason_id.name
                or 'غير محدد'
            ) if scrap.damage_reason_id else 'غير محدد'

            if rname not in by_reason:
                by_reason[rname] = {'count': 0, 'value': 0.0}
            by_reason[rname]['count'] += 1
            by_reason[rname]['value'] += scrap.damage_value

        return {
            'total_value':  round(total_value, 2),
            'total_count':  total_count,
            'by_reason':    [
                {
                    'reason': k,
                    'count':  v['count'],
                    'value':  round(v['value'], 2),
                }
                for k, v in sorted(
                    by_reason.items(),
                    key=lambda x: x[1]['value'],
                    reverse=True,
                )
            ],
        }

    # -------------------------------------------------------------------------
    # Monthly Trend
    # -------------------------------------------------------------------------

    @api.model
    def _get_monthly_trend(self, months=6):
        """Monthly sales totals for trend chart."""
        today  = date.today()
        result = []

        for i in range(months - 1, -1, -1):
            period_start = (today - relativedelta(months=i)).replace(day=1)
            period_end   = (
                period_start + relativedelta(months=1) - timedelta(days=1)
            )

            sales = self._get_sales_total(period_start, period_end)

            result.append({
                'month':      str(period_start)[:7],
                'label':      period_start.strftime('%b %Y'),
                'label_ar':   period_start.strftime('%m/%Y'),
                'sales':      sales,
                'is_current': i == 0,
            })

        return result

    # -------------------------------------------------------------------------
    # Sales by Customer Type
    # -------------------------------------------------------------------------

    @api.model
    def _get_sales_by_customer_type(self, date_from, date_to):
        """
        Break down period sales by customer type.
        """
        type_labels = {
            'retail':      'تجزئة / Retail',
            'electrician': 'كهربائي / Electrician',
            'contractor':  'مقاول / Contractor',
            'company':     'شركة / Company',
            'unknown':     'غير محدد / Unknown',
        }

        type_data = {k: 0.0 for k in type_labels}

        orders = self.env['sale.order'].search([
            ('state',      'in', ('sale', 'done')),
            ('date_order', '>=', f'{date_from} 00:00:00'),
            ('date_order', '<=', f'{date_to} 23:59:59'),
        ])

        for order in orders:
            ctype = (
                order.partner_id.commercial_partner_id.customer_type
                or 'unknown'
            )
            if ctype not in type_data:
                ctype = 'unknown'
            type_data[ctype] += order.amount_total

        pos_orders = self.env['pos.order'].search([
            ('state',      'in', ('paid', 'done', 'invoiced')),
            ('date_order', '>=', f'{date_from} 00:00:00'),
            ('date_order', '<=', f'{date_to} 23:59:59'),
        ])

        for order in pos_orders:
            if order.partner_id:
                ctype = (
                    order.partner_id.commercial_partner_id.customer_type
                    or 'retail'
                )
            else:
                ctype = 'retail'
            if ctype not in type_data:
                ctype = 'unknown'
            type_data[ctype] += order.amount_total

        total = sum(type_data.values()) or 1.0

        return [
            {
                'type':    k,
                'label':   type_labels.get(k, k),
                'revenue': round(v, 2),
                'pct':     round((v / total) * 100, 1),
            }
            for k, v in type_data.items()
            if v > 0
        ]

    # -------------------------------------------------------------------------
    # POS Summary
    # -------------------------------------------------------------------------

    @api.model
    def _get_pos_summary(self, today):
        """Today's POS session summary."""
        sessions = self.env['pos.session'].search([
            ('start_at', '>=', f'{today} 00:00:00'),
        ])

        open_sessions   = sessions.filtered(
            lambda s: s.state == 'opened'
        )
        closed_sessions = sessions.filtered(
            lambda s: s.state == 'closed'
        )

        today_pos_orders = self.env['pos.order'].search([
            ('state',      'in', ('paid', 'done', 'invoiced')),
            ('date_order', '>=', f'{today} 00:00:00'),
            ('date_order', '<=', f'{today} 23:59:59'),
        ])

        return {
            'open_sessions':   len(open_sessions),
            'closed_sessions': len(closed_sessions),
            'total_sessions':  len(sessions),
            'today_orders':    len(today_pos_orders),
            'today_revenue':   round(
                sum(today_pos_orders.mapped('amount_total')), 2
            ),
        }