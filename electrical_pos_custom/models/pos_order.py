# -*- coding: utf-8 -*-
from odoo import api, fields, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    # -------------------------------------------------------------------------
    # Credit Validation RPC
    # -------------------------------------------------------------------------

    @api.model
    def get_customer_credit_info(self, partner_id):
        """
        Called from POS frontend when a customer is selected.
        Returns full credit info for display and validation.

        :param partner_id: int — res.partner ID
        :return: dict with credit fields
        """
        if not partner_id:
            return {}

        partner = self.env['res.partner'].browse(partner_id)
        if not partner.exists():
            return {}

        commercial = partner.commercial_partner_id

        return {
            'id':                  commercial.id,
            'name':                commercial.name or '',
            'customer_type':       commercial.customer_type or 'retail',
            'credit_limit':        commercial.credit_limit or 0.0,
            'credit_used':         commercial.credit_used or 0.0,
            'credit_available':    commercial.credit_available or 0.0,
            'credit_status':       commercial.credit_status or 'ok',
            'warning_threshold':   commercial.warning_threshold or 80.0,
            'blocking_threshold':  commercial.blocking_threshold or 100.0,
        }

    @api.model
    def check_credit_before_payment(self, partner_id, order_amount):
        """
        Validate credit limit before processing POS payment.
        Called from POS PaymentScreen before confirming payment.

        :param partner_id: int — res.partner ID
        :param order_amount: float — total order amount
        :return: dict — {allowed: bool, status: str, message: str}
        """
        if not partner_id or not order_amount:
            return {'allowed': True, 'status': 'ok', 'message': ''}

        partner = self.env['res.partner'].browse(partner_id)
        if not partner.exists():
            return {'allowed': True, 'status': 'ok', 'message': ''}

        commercial = partner.commercial_partner_id
        credit_limit = commercial.credit_limit

        # No credit limit set — always allow
        if credit_limit <= 0:
            return {'allowed': True, 'status': 'ok', 'message': ''}

        projected_used = commercial.credit_used + order_amount
        usage_pct = (projected_used / credit_limit) * 100

        if usage_pct >= commercial.blocking_threshold:
            return {
                'allowed': False,
                'status': 'blocked',
                'message': (
                    f'تجاوز العميل الحد الائتماني المسموح به.\n'
                    f'الحد: {credit_limit:.2f} — '
                    f'المستخدم: {commercial.credit_used:.2f} — '
                    f'الطلب: {order_amount:.2f}'
                ),
            }

        if usage_pct >= commercial.warning_threshold:
            return {
                'allowed': True,
                'status': 'warning',
                'message': (
                    f'تحذير: العميل وصل إلى {usage_pct:.0f}٪ '
                    f'من الحد الائتماني.'
                ),
            }

        return {'allowed': True, 'status': 'ok', 'message': ''}

    # -------------------------------------------------------------------------
    # Stock Info RPC
    # -------------------------------------------------------------------------

    @api.model
    def get_product_stock_info(self, product_id, location_id=None):
        """
        Called from POS frontend to get real-time stock quantity.

        :param product_id: int — product.product ID
        :param location_id: int — stock.location ID (optional)
        :return: dict — {qty_available, uom_name}
        """
        if not product_id:
            return {'qty_available': 0.0, 'uom_name': ''}

        product = self.env['product.product'].browse(product_id)
        if not product.exists():
            return {'qty_available': 0.0, 'uom_name': ''}

        if location_id:
            location = self.env['stock.location'].browse(location_id)
            qty = product.with_context(location=location.id).qty_available
        else:
            qty = product.qty_available

        return {
            'qty_available': qty,
            'uom_name':      product.uom_id.name or '',
        }

    # -------------------------------------------------------------------------
    # Product Info RPC
    # -------------------------------------------------------------------------

    @api.model
    def get_product_electrical_info(self, product_tmpl_id):
        """
        Called from POS product info popup.
        Returns electrical specifications for a product.

        :param product_tmpl_id: int — product.template ID
        :return: dict with electrical fields
        """
        if not product_tmpl_id:
            return {}

        tmpl = self.env['product.template'].browse(product_tmpl_id)
        if not tmpl.exists():
            return {}

        return {
            'brand':           tmpl.brand_id.name if tmpl.brand_id else '',
            'brand_arabic':    tmpl.brand_id.name_arabic if tmpl.brand_id else '',
            'watt':            tmpl.watt or 0.0,
            'voltage':         tmpl.voltage or '',
            'warranty_months': tmpl.warranty_months or 0,
            'shelf_location':  tmpl.shelf_location or '',
            'product_alias':   tmpl.product_alias or '',
            'arabic_keywords': tmpl.arabic_keywords or '',
        }

    # -------------------------------------------------------------------------
    # Packaging RPC
    # -------------------------------------------------------------------------

    @api.model
    def get_product_packaging_options(self, product_id):
        """
        Returns available packaging options for a product.
        Called from POS packaging selector popup.

        :param product_id: int — product.product ID
        :return: list of packaging dicts
        """
        if not product_id:
            return []

        product = self.env['product.product'].browse(product_id)
        if not product.exists():
            return []

        packagings = product.packaging_ids
        result = []

        # Always include base unit (piece / meter)
        result.append({
            'id':             0,
            'name':           product.uom_id.name or 'Unit',
            'arabic_name':    '',
            'display_name':   product.uom_id.name or 'Unit',
            'qty':            1.0,
            'packaging_type': 'piece',
            'barcode':        '',
            'is_base':        True,
        })

        for pack in packagings:
            result.append({
                'id':             pack.id,
                'name':           pack.name or '',
                'arabic_name':    pack.arabic_name or '',
                'display_name':   pack.arabic_name or pack.name or '',
                'qty':            pack.qty,
                'packaging_type': pack.packaging_type or '',
                'barcode':        pack.barcode or '',
                'is_base':        False,
            })

        return result