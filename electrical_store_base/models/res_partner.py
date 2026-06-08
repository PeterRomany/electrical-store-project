# -*- coding: utf-8 -*-
from odoo import fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # -------------------------------------------------------------------------
    # Customer Type
    # -------------------------------------------------------------------------

    customer_type = fields.Selection(
        selection=[
            ('retail',      'Retail / تجزئة'),
            ('electrician', 'Electrician / كهربائي'),
            ('contractor',  'Contractor / مقاول'),
            ('company',     'Company / شركة'),
        ],
        string='Customer Type / نوع العميل',
        default='retail',
        index=True,
        tracking=True,
        help='Used for customer segmentation and future price list rules.',
    )

    # -------------------------------------------------------------------------
    # Display helper
    # -------------------------------------------------------------------------

    def _get_customer_type_label(self):
        """Return Arabic label for customer type."""
        self.ensure_one()
        labels = {
            'retail':      'تجزئة',
            'electrician': 'كهربائي',
            'contractor':  'مقاول',
            'company':     'شركة',
        }
        return labels.get(self.customer_type, '')