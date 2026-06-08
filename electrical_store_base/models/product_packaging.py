# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import ValidationError


class ProductPackaging(models.Model):
    _inherit = 'product.packaging'

    # -------------------------------------------------------------------------
    # Packaging Type Classification
    # -------------------------------------------------------------------------

    packaging_type = fields.Selection(
        selection=[
            ('piece',   'Piece / قطعة'),
            ('box',     'Box / كرتونة'),
            ('carton',  'Carton / كرتون'),
            ('pack',    'Pack / باكيت'),
            ('meter',   'Meter / متر'),
            ('roll',    'Roll / لفة'),
        ],
        string='Packaging Type / نوع التعبئة',
        index=True,
        help='Defines the packaging unit type for POS unit selection.',
    )

    arabic_name = fields.Char(
        string='Arabic Name / الاسم بالعربية',
        size=64,
        help='Arabic display name shown in POS unit selector.',
    )

    # -------------------------------------------------------------------------
    # Constraints
    # -------------------------------------------------------------------------

    @api.constrains('qty', 'product_id')
    def _check_qty_positive(self):
        for pack in self:
            if pack.qty <= 0:
                raise ValidationError(
                    'Packaging quantity must be greater than zero.\n'
                    'يجب أن تكون كمية التعبئة أكبر من الصفر.'
                )

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def get_display_name(self):
        """
        Return display name for POS unit selector.
        Uses arabic_name if set, otherwise falls back to name.
        """
        self.ensure_one()
        return self.arabic_name or self.name or ''

    def get_pos_info(self):
        """
        Return dict consumed by POS JS for unit selection popup.
        """
        self.ensure_one()
        return {
            'id':             self.id,
            'name':           self.name or '',
            'arabic_name':    self.arabic_name or '',
            'display_name':   self.get_display_name(),
            'qty':            self.qty,
            'packaging_type': self.packaging_type or '',
            'barcode':        self.barcode or '',
        }