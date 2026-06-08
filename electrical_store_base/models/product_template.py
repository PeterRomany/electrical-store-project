# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    # -------------------------------------------------------------------------
    # Brand
    # -------------------------------------------------------------------------

    brand_id = fields.Many2one(
        comodel_name='electrical.brand',
        string='Brand / الماركة',
        index=True,
        tracking=True,
    )

    # -------------------------------------------------------------------------
    # Electrical Specifications
    # -------------------------------------------------------------------------

    watt = fields.Float(
        string='Watt / الواط',
        digits=(10, 2),
        default=0.0,
        help='Power consumption or output in watts. Example: 9.00, 60.00',
    )
    voltage = fields.Char(
        string='Voltage / الجهد',
        size=32,
        help='Operating voltage. Example: 220V, 12V, 12-24V, 110-240V',
    )
    warranty_months = fields.Integer(
        string='Warranty (Months) / الضمان',
        default=0,
        help='Warranty period in months. 0 = no warranty.',
    )

    # -------------------------------------------------------------------------
    # Store Information
    # -------------------------------------------------------------------------

    shelf_location = fields.Char(
        string='Shelf Location / موقع الرف',
        size=64,
        index=True,
        help='Physical shelf label inside the store. Example: A3-S2, B1-TOP',
    )
    product_alias = fields.Char(
        string='Product Alias / الاسم الشائع',
        size=128,
        index=True,
        help='Common trade name or shorthand used by staff and customers.',
    )
    arabic_keywords = fields.Text(
        string='Arabic Search Keywords / كلمات البحث العربية',
        help='Space-separated Arabic terms used for POS and product search. '
             'Example: لمبة ليد توفير طاقة',
    )

    # -------------------------------------------------------------------------
    # Name Search Override
    # -------------------------------------------------------------------------

    @api.model
    def _name_search(
        self,
        name='',
        domain=None,
        operator='ilike',
        limit=100,
        order=None,
    ):
        """
        Extend standard name search to include:
        - product_alias
        - arabic_keywords
        - default_code (internal reference)
        - brand name
        """
        domain = domain or []

        if name:
            extra = [
                '|', '|', '|',
                ('product_alias', operator, name),
                ('arabic_keywords', operator, name),
                ('default_code', operator, name),
                ('brand_id.name', operator, name),
            ]
            domain = extra + domain

        return super()._name_search(
            name=name,
            domain=domain,
            operator=operator,
            limit=limit,
            order=order,
        )

    # -------------------------------------------------------------------------
    # Warranty Helper
    # -------------------------------------------------------------------------

    def _get_warranty_label(self):
        """Return human-readable warranty string."""
        self.ensure_one()
        if not self.warranty_months:
            return 'No Warranty / بدون ضمان'
        if self.warranty_months < 12:
            return f'{self.warranty_months} Month(s) / شهر'
        years = self.warranty_months // 12
        months = self.warranty_months % 12
        label = f'{years} Year(s)'
        if months:
            label += f' {months} Month(s)'
        return label