# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ElectricalBrand(models.Model):
    _name = 'electrical.brand'
    _description = 'Electrical Product Brand'
    _order = 'name asc'
    _rec_name = 'name'

    name = fields.Char(
        string='Brand Name',
        required=True,
        translate=True,
        index=True,
    )
    name_arabic = fields.Char(
        string='Arabic Name / الاسم بالعربية',
        translate=False,
    )
    country_of_origin = fields.Many2one(
        comodel_name='res.country',
        string='Country of Origin',
    )
    active = fields.Boolean(
        default=True,
    )
    notes = fields.Text(
        string='Notes',
    )
    product_count = fields.Integer(
        string='Products',
        compute='_compute_product_count',
        store=False,
    )

    # -------------------------------------------------------------------------
    # Constraints
    # -------------------------------------------------------------------------

    _sql_constraints = [
        (
            'name_unique',
            'UNIQUE(name)',
            'Brand name must be unique.',
        ),
    ]

    # -------------------------------------------------------------------------
    # Compute
    # -------------------------------------------------------------------------

    def _compute_product_count(self):
        grouped = self.env['product.template'].read_group(
            domain=[('brand_id', 'in', self.ids)],
            fields=['brand_id'],
            groupby=['brand_id'],
        )
        counts = {g['brand_id'][0]: g['brand_id_count'] for g in grouped}
        for brand in self:
            brand.product_count = counts.get(brand.id, 0)

    # -------------------------------------------------------------------------
    # Actions
    # -------------------------------------------------------------------------

    def action_view_products(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Products',
            'res_model': 'product.template',
            'view_mode': 'list,form',
            'domain': [('brand_id', '=', self.id)],
            'context': {'default_brand_id': self.id},
        }