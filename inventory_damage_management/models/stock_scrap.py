# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class StockScrap(models.Model):
    _inherit = 'stock.scrap'

    # -------------------------------------------------------------------------
    # Damage Fields
    # -------------------------------------------------------------------------

    damage_reason_id = fields.Many2one(
        comodel_name='damage.reason',
        string='سبب التلف',
        index=True,
        tracking=True,
        help='Reason why this product is being scrapped/damaged.',
    )
    damage_notes = fields.Text(
        string='ملاحظات التلف',
        help='Additional details about the damage.',
    )
    damage_value = fields.Float(
        string='قيمة التلف',
        compute='_compute_damage_value',
        store=True,
        digits=(16, 2),
        help='Estimated monetary value of the scrapped items.',
    )
    damage_photo = fields.Binary(
        string='Damage Photo / صورة التلف',
        attachment=True,
        help='Optional photo of the damaged product.',
    )
    damage_photo_filename = fields.Char(
        string='Photo Filename',
    )
    reported_by_id = fields.Many2one(
        comodel_name='res.users',
        string='Reported By / بواسطة',
        default=lambda self: self.env.user,
        tracking=True,
    )

    # -------------------------------------------------------------------------
    # Computed Fields
    # -------------------------------------------------------------------------

    @api.depends('scrap_qty', 'product_id', 'product_id.standard_price')
    def _compute_damage_value(self):
        for scrap in self:
            cost = scrap.product_id.standard_price or 0.0
            scrap.damage_value = cost * (scrap.scrap_qty or 0.0)

    # -------------------------------------------------------------------------
    # Constraints
    # -------------------------------------------------------------------------

    @api.constrains('damage_reason_id', 'state')
    def _check_damage_reason_required(self):
        """
        Enforce damage reason on validated scraps.
        Only required when state transitions to 'done'.
        """
        for scrap in self:
            if scrap.state == 'done' and not scrap.damage_reason_id:
                raise ValidationError(_(
                    'Damage reason is required before validating a scrap operation.\n'
                    'يجب تحديد سبب التلف قبل تأكيد عملية الإتلاف.\n\n'
                    'Product: %(product)s',
                    product=scrap.product_id.display_name,
                ))

    # -------------------------------------------------------------------------
    # Override: action_validate
    # -------------------------------------------------------------------------

    def action_validate(self):
        """
        Intercept scrap validation to enforce damage reason.
        """
        for scrap in self:
            if not scrap.damage_reason_id:
                raise ValidationError(_(
                    'Cannot validate scrap without a damage reason.\n'
                    'لا يمكن تأكيد الإتلاف بدون تحديد سبب التلف.\n\n'
                    'Product: %(product)s\n'
                    'Qty: %(qty)s',
                    product=scrap.product_id.display_name,
                    qty=scrap.scrap_qty,
                ))
        return super().action_validate()

    # -------------------------------------------------------------------------
    # Reporting Helpers
    # -------------------------------------------------------------------------

    @api.model
    def get_damage_statistics(self, date_from=None, date_to=None):
        """
        Return damage statistics for dashboard and reports.

        :param date_from: date — start of period
        :param date_to:   date — end of period
        :returns: dict with damage stats
        """
        domain = [('state', '=', 'done')]

        if date_from:
            domain.append(('date_done', '>=', date_from))
        if date_to:
            domain.append(('date_done', '<=', date_to))

        scraps = self.search(domain)

        # By reason
        by_reason = {}
        for scrap in scraps:
            reason_name = (
                scrap.damage_reason_id.name_arabic
                or scrap.damage_reason_id.name
                or 'Unknown / غير محدد'
            )
            if reason_name not in by_reason:
                by_reason[reason_name] = {
                    'count': 0,
                    'value': 0.0,
                }
            by_reason[reason_name]['count'] += 1
            by_reason[reason_name]['value'] += scrap.damage_value

        # By product
        by_product = {}
        for scrap in scraps:
            prod_name = scrap.product_id.display_name or 'Unknown'
            if prod_name not in by_product:
                by_product[prod_name] = {
                    'count': 0,
                    'qty':   0.0,
                    'value': 0.0,
                }
            by_product[prod_name]['count'] += 1
            by_product[prod_name]['qty']   += scrap.scrap_qty
            by_product[prod_name]['value'] += scrap.damage_value

        total_value = sum(s.damage_value for s in scraps)
        total_count = len(scraps)

        return {
            'total_count':  total_count,
            'total_value':  total_value,
            'by_reason':    by_reason,
            'by_product':   dict(
                sorted(
                    by_product.items(),
                    key=lambda x: x[1]['value'],
                    reverse=True,
                )[:10]
            ),
        }

    @api.model
    def get_monthly_damage_trend(self, months=6):
        """
        Return monthly damage totals for trend chart.

        :param months: int — number of past months to include
        :returns: list of {month, count, value}
        """
        from datetime import date, timedelta
        from dateutil.relativedelta import relativedelta

        result = []
        today  = date.today()

        for i in range(months - 1, -1, -1):
            period_start = (today - relativedelta(months=i)).replace(day=1)
            period_end   = (
                period_start + relativedelta(months=1) - timedelta(days=1)
            )

            scraps = self.search([
                ('state',     '=', 'done'),
                ('date_done', '>=', str(period_start)),
                ('date_done', '<=', str(period_end)),
            ])

            result.append({
                'month': period_start.strftime('%Y-%m'),
                'label': period_start.strftime('%b %Y'),
                'count': len(scraps),
                'value': sum(s.damage_value for s in scraps),
            })

        return result
