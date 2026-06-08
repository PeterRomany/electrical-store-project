# -*- coding: utf-8 -*-
from odoo import api, models


class PosOrder(models.Model):
    _inherit = 'pos.order'

    # -------------------------------------------------------------------------
    # RPC: Customer Credit Info
    # -------------------------------------------------------------------------

    @api.model
    def get_customer_credit_info(self, partner_id):
        """
        Called from POS frontend when a customer is selected.
        Returns full credit info for display and validation.

        :param partner_id: int — res.partner ID
        :returns: dict with all credit fields
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
            'credit_usage_pct':    commercial.credit_usage_pct or 0.0,
            'credit_status':       commercial.credit_status or 'ok',
            'warning_threshold':   commercial.warning_threshold or 80.0,
            'blocking_threshold':  commercial.blocking_threshold or 100.0,
            'credit_status_label': commercial.get_credit_status_label(),
        }

    # -------------------------------------------------------------------------
    # RPC: Credit Check Before POS Payment
    # -------------------------------------------------------------------------

    @api.model
    def check_credit_before_payment(self, partner_id, order_amount):
        """
        Validate credit limit before processing POS payment.
        Called from POS PaymentScreen patch before confirming payment.

        :param partner_id:    int   — res.partner ID
        :param order_amount:  float — total order amount including tax
        :returns: dict — {allowed, status, message}
        """
        if not partner_id or not order_amount:
            return {
                'allowed': True,
                'status':  'ok',
                'message': '',
            }

        return self.env['sale.order']._check_credit_limit_for_partner(
            partner_id,
            order_amount,
        )

    # -------------------------------------------------------------------------
    # RPC: Refresh Partner Credit After Order
    # -------------------------------------------------------------------------

    @api.model
    def refresh_partner_credit(self, partner_id):
        """
        Refresh and return updated credit info after a POS order is placed.
        Called after successful payment to update POS display.

        :param partner_id: int — res.partner ID
        :returns: dict — updated credit info
        """
        return self.get_customer_credit_info(partner_id)

    # -------------------------------------------------------------------------
    # RPC: Manager Override Check
    # -------------------------------------------------------------------------

    @api.model
    def verify_manager_credit_override(self, user_id, pin):
        """
        Verify that a user has manager rights to override credit block.
        Called from POS PaymentScreen when manager PIN is entered.

        :param user_id: int  — res.users ID
        :param pin:     str  — manager PIN or password
        :returns: dict — {valid, user_name, message}
        """
        if not user_id or not pin:
            return {
                'valid':     False,
                'user_name': '',
                'message':   'بيانات التحقق غير مكتملة.',
            }

        user = self.env['res.users'].browse(user_id)
        if not user.exists():
            return {
                'valid':     False,
                'user_name': '',
                'message':   'المستخدم غير موجود.',
            }

        # Check manager group
        is_manager = user.has_group(
            'electrical_store_base.group_electrical_manager'
        )

        if not is_manager:
            return {
                'valid':     False,
                'user_name': user.name,
                'message':   f'{user.name} ليس لديه صلاحية المدير.',
            }

        return {
            'valid':     True,
            'user_name': user.name,
            'message':   f'تم التحقق من صلاحية المدير: {user.name}',
        }