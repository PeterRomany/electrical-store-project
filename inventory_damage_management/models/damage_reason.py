# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DamageReason(models.Model):
    _name        = 'damage.reason'
    _description = 'سبب التلف'
    _order       = 'sequence asc, name asc'
    _rec_name    = 'name'

    # -------------------------------------------------------------------------
    # Fields
    # -------------------------------------------------------------------------

    name = fields.Char(
        string='السبب',
        required=True,
        translate=True,
        index=True,
    )
    name_arabic = fields.Char(
        string='الاسم بالعربية',
        size=128,
    )
    code = fields.Char(
        string='الكود',
        size=16,
        index=True,
        help='Short reference code for reporting. Example: PHY, WAT, ELC',
    )
    sequence = fields.Integer(
        string='الترتيب',
        default=10,
        help='Display order in lists and reports.',
    )
    active = fields.Boolean(
        default=True,
    )
    color = fields.Integer(
        string='اللون',
        default=0,
        help='Color used in kanban and reports.',
    )
    notes = fields.Text(
        string='الوصف',
        translate=True,
        help='Detailed description of this damage reason.',
    )
    scrap_count = fields.Integer(
        string='عمليات الإتلاف',
        compute='_compute_scrap_count',
        store=False,
    )
    scrap_value = fields.Float(
        string='إجمالي قيمة التلف',
        compute='_compute_scrap_count',
        store=False,
        digits=(16, 2),
    )

    # -------------------------------------------------------------------------
    # SQL Constraints
    # -------------------------------------------------------------------------

    _sql_constraints = [
        (
            'code_unique',
            'UNIQUE(code)',
            'Damage reason code must be unique.',
        ),
    ]

    # -------------------------------------------------------------------------
    # Compute
    # -------------------------------------------------------------------------

    def _compute_scrap_count(self):
        for reason in self:
            scraps = self.env['stock.scrap'].search([
                ('damage_reason_id', '=', reason.id),
                ('state', '=', 'done'),
            ])
            reason.scrap_count  = len(scraps)
            reason.scrap_value  = sum(
                s.product_id.standard_price * s.scrap_qty
                for s in scraps
            )

    # -------------------------------------------------------------------------
    # Actions
    # -------------------------------------------------------------------------

    def action_view_scraps(self):
        """Open scrap operations filtered by this damage reason."""
        self.ensure_one()
        return {
            'type':      'ir.actions.act_window',
            'name':      f'Scrap Operations — {self.name}',
            'res_model': 'stock.scrap',
            'view_mode': 'list,form',
            'domain':    [('damage_reason_id', '=', self.id)],
            'context':   {'default_damage_reason_id': self.id},
        }

    # -------------------------------------------------------------------------
    # Display Name
    # -------------------------------------------------------------------------

    def name_get(self):
        result = []
        for reason in self:
            display = reason.name_arabic or reason.name
            if reason.code:
                display = f'[{reason.code}] {display}'
            result.append((reason.id, display))
        return result

    @api.model
    def _name_search(
        self,
        name='',
        domain=None,
        operator='ilike',
        limit=100,
        order=None,
    ):
        domain = domain or []
        if name:
            domain = [
                '|', '|',
                ('name', operator, name),
                ('name_arabic', operator, name),
                ('code', operator, name),
            ] + domain
        return super()._name_search(
            name=name,
            domain=domain,
            operator=operator,
            limit=limit,
            order=order,
        )
