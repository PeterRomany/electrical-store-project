# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # -------------------------------------------------------------------------
    # Credit Limit Settings
    # -------------------------------------------------------------------------

    credit_limit = fields.Float(
        string='الحد الائتماني',
        default=0.0,
        digits=(16, 2),
        tracking=True,
        help='Maximum outstanding balance allowed for this customer.\n'
             '0.00 = No credit limit (unlimited).',
        groups='electrical_store_base.group_electrical_accountant,'
               'electrical_store_base.group_electrical_manager',
    )
    warning_threshold = fields.Float(
        string='نسبة التحذير (%)',
        default=80.0,
        digits=(5, 2),
        help='Show warning when credit usage reaches this percentage.\n'
             'Example: 80 = warn when 80%% of limit is used.',
        groups='electrical_store_base.group_electrical_accountant,'
               'electrical_store_base.group_electrical_manager',
    )
    blocking_threshold = fields.Float(
        string='نسبة الحظر (%)',
        default=100.0,
        digits=(5, 2),
        help='Block sales when credit usage reaches this percentage.\n'
             'Example: 100 = block when limit is fully reached.',
        groups='electrical_store_base.group_electrical_accountant,'
               'electrical_store_base.group_electrical_manager',
    )

    # -------------------------------------------------------------------------
    # Computed Credit Fields
    # -------------------------------------------------------------------------

    credit_used = fields.Float(
        string='الرصيد المستخدم',
        compute='_compute_credit_status',
        store=False,
        digits=(16, 2),
        help='Total outstanding unpaid invoiced amount for this customer.',
    )
    credit_available = fields.Float(
        string='الرصيد المتاح',
        compute='_compute_credit_status',
        store=False,
        digits=(16, 2),
        help='Remaining credit available: Credit Limit - Credit Used.',
    )
    credit_usage_pct = fields.Float(
        string='نسبة استخدام الائتمان (%)',
        compute='_compute_credit_status',
        store=False,
        digits=(5, 2),
        help='Percentage of credit limit currently used.',
    )
    credit_status = fields.Selection(
        selection=[
            ('ok',      'جيد'),
            ('warning', 'تحذير'),
            ('blocked', 'محظور'),
        ],
        string='حالة الائتمان',
        compute='_compute_credit_status',
        store=False,
        help='Current credit status based on usage vs thresholds.',
        search='_search_credit_status',
    )

    # -------------------------------------------------------------------------
    # Compute
    # -------------------------------------------------------------------------

    @api.depends(
        'credit_limit',
        'warning_threshold',
        'blocking_threshold',
        'invoice_ids.amount_residual',
        'invoice_ids.payment_state',
        'invoice_ids.state',
        'invoice_ids.move_type',
        'child_ids.invoice_ids.amount_residual',
    )
    def _compute_credit_status(self):
        for partner in self:
            # Get commercial partner (parent for companies)
            commercial = partner.commercial_partner_id

            # Sum all unpaid/partially paid posted invoices
            domain = [
                ('partner_id',    'child_of', commercial.id),
                ('move_type',     'in',       ('out_invoice', 'out_receipt')),
                ('payment_state', 'in',       ('not_paid', 'partial')),
                ('state',         '=',        'posted'),
            ]
            moves = self.env['account.move'].search(domain)
            credit_used = sum(moves.mapped('amount_residual'))

            # Subtract credit notes outstanding
            refund_domain = [
                ('partner_id',    'child_of', commercial.id),
                ('move_type',     '=',        'out_refund'),
                ('payment_state', 'in',       ('not_paid', 'partial')),
                ('state',         '=',        'posted'),
            ]
            refunds = self.env['account.move'].search(refund_domain)
            credit_used -= sum(refunds.mapped('amount_residual'))
            credit_used  = max(0.0, credit_used)

            partner.credit_used = credit_used

            limit = partner.credit_limit
            if limit <= 0:
                # No limit configured
                partner.credit_available  = 0.0
                partner.credit_usage_pct  = 0.0
                partner.credit_status     = 'ok'
            else:
                partner.credit_available = max(0.0, limit - credit_used)
                usage_pct                = (credit_used / limit) * 100.0
                partner.credit_usage_pct = usage_pct

                if usage_pct >= partner.blocking_threshold:
                    partner.credit_status = 'blocked'
                elif usage_pct >= partner.warning_threshold:
                    partner.credit_status = 'warning'
                else:
                    partner.credit_status = 'ok'

    def _search_credit_status(self, operator, value):
        """Search the live, non-stored credit status field.

        Credit status is computed from current outstanding invoices, so it is
        intentionally not stored and needs a custom search implementation.
        """
        partners = self.search([])
        partners._compute_credit_status()

        if operator in ('=', '=='):
            matching = partners.filtered(lambda p: p.credit_status == value)
        elif operator == '!=':
            matching = partners.filtered(lambda p: p.credit_status != value)
        elif operator == 'in':
            values = set(value or [])
            matching = partners.filtered(lambda p: p.credit_status in values)
        elif operator == 'not in':
            values = set(value or [])
            matching = partners.filtered(lambda p: p.credit_status not in values)
        else:
            return [('id', '=', False)]

        return [('id', 'in', matching.ids)]

    # -------------------------------------------------------------------------
    # SQL Constraints
    # -------------------------------------------------------------------------

    _sql_constraints = [
        (
            'credit_limit_positive',
            'CHECK(credit_limit >= 0)',
            'Credit limit must be zero or positive.',
        ),
        (
            'warning_threshold_range',
            'CHECK(warning_threshold >= 0 AND warning_threshold <= 100)',
            'Warning threshold must be between 0 and 100.',
        ),
        (
            'blocking_threshold_range',
            'CHECK(blocking_threshold >= 0 AND blocking_threshold <= 100)',
            'Blocking threshold must be between 0 and 100.',
        ),
    ]

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def get_credit_status_label(self):
        """Return Arabic credit status label."""
        self.ensure_one()
        labels = {
            'ok':      'جيد ✅',
            'warning': 'تحذير ⚠️',
            'blocked': 'محظور 🚫',
        }
        return labels.get(self.credit_status, 'جيد ✅')

    def can_place_order(self, amount=0.0):
        """
        Check if customer can place an order for given amount.

        :param amount: float — order amount to check
        :returns: tuple(bool, str) — (allowed, message)
        """
        self.ensure_one()
        commercial = self.commercial_partner_id

        if commercial.credit_limit <= 0:
            return True, ''

        projected = commercial.credit_used + amount
        pct       = (projected / commercial.credit_limit) * 100.0

        if pct >= commercial.blocking_threshold:
            msg = (
                f'العميل {commercial.name} تجاوز الحد الائتماني.\n'
                f'الحد: {commercial.credit_limit:.2f} — '
                f'المستخدم: {commercial.credit_used:.2f} — '
                f'الطلب: {amount:.2f}'
            )
            return False, msg

        if pct >= commercial.warning_threshold:
            msg = (
                f'تحذير: {commercial.name} وصل إلى '
                f'{pct:.0f}٪ من الحد الائتماني.'
            )
            return True, msg

        return True, ''
