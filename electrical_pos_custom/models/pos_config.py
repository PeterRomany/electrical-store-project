# -*- coding: utf-8 -*-
from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    # -------------------------------------------------------------------------
    # Electrical Store POS Settings
    # -------------------------------------------------------------------------

    iface_arabic_search = fields.Boolean(
        string='Enable Arabic Search / تفعيل البحث بالعربية',
        default=True,
        help='Allow cashiers to search products by Arabic name, '
             'alias, and keywords.',
    )
    iface_show_stock = fields.Boolean(
        string='Show Stock in POS / عرض المخزون',
        default=True,
        help='Display available stock quantity on product cards in POS.',
    )
    iface_show_electrical_info = fields.Boolean(
        string='Show Electrical Info / عرض المعلومات الكهربائية',
        default=True,
        help='Display brand, watt, voltage, and shelf location '
             'on product info popup.',
    )
    iface_packaging_selector = fields.Boolean(
        string='Enable Packaging Selector / تفعيل اختيار التعبئة',
        default=True,
        help='Allow cashiers to select packaging unit '
             '(Piece, Box, Carton, Pack, Meter, Roll) per order line.',
    )
    iface_credit_warning = fields.Boolean(
        string='Enable Credit Limit Warning / تفعيل تحذير الحد الائتماني',
        default=True,
        help='Warn or block cashier when customer exceeds credit limit.',
    )
    iface_show_customer_balance = fields.Boolean(
        string='Show Customer Balance / عرض رصيد العميل',
        default=True,
        help='Display outstanding balance and credit status '
             'when a customer is selected in POS.',
    )
    iface_rtl = fields.Boolean(
        string='RTL Arabic Layout / تخطيط عربي',
        default=True,
        help='Enable right-to-left layout for full Arabic UI support.',
    )

    # -------------------------------------------------------------------------
    # POS Data Loading
    # -------------------------------------------------------------------------

    def _get_pos_ui_electrical_pos_custom(self, params):
        """
        Send electrical store configuration to POS frontend.
        Called automatically by Odoo POS loader.
        """
        return {
            'iface_arabic_search':       self.iface_arabic_search,
            'iface_show_stock':          self.iface_show_stock,
            'iface_show_electrical_info': self.iface_show_electrical_info,
            'iface_packaging_selector':  self.iface_packaging_selector,
            'iface_credit_warning':      self.iface_credit_warning,
            'iface_show_customer_balance': self.iface_show_customer_balance,
            'iface_rtl':                 self.iface_rtl,
        }