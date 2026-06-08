# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import UserError


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    # -------------------------------------------------------------------------
    # Credit Status Fields (display only)
    # -------------------------------------------------------------------------

    partner_credit_status = fields.Selection(
        related='partner_id.commercial_partner_id.credit_status',
        string='Credit Status / حالة الائتمان',
        store=False,
        readonly=True,
    )
    partner_credit_limit = fields.Float(
        related='partner_id.commercial_partner_id.credit_limit',
        string='Credit Limit / الحد الائتماني',
        store=False,
        readonly=True,
    )
    partner_credit_used = fields.Float(
        related='partner_id.commercial_partner_id.credit_used',
        string='Credit Used / الرصيد المستخدم',
        store=False,
        readonly=True,
    )
    partner_credit_available = fields.Float(
        related='partner_id.commercial_partner_id.credit_available',
        string='Credit Available / الرصيد المتاح',
        store=False,
        readonly=True,
    )
    credit_override_reason = fields.Text(
        string='Credit Override Reason / سبب التجاوز',
        copy=False,
        help='Reason provided by manager when overriding a credit block.',
        groups='electrical_store_base.group_electrical_accountant,'
               'electrical_store_base.group_electrical_manager',
    )
    credit_override_user_id = fields.Many2one(
        comodel_name='res.users',
        string='Override By / التجاوز بواسطة',
        copy=False,
        readonly=True,
        groups='electrical_store_base.group_electrical_accountant,'
               'electrical_store_base.group_electrical_manager',
    )

    # -------------------------------------------------------------------------
    # Override: action_confirm
    # -------------------------------------------------------------------------

    def action_confirm(self):
        """
        Intercept sale order confirmation to validate credit limit.
        - If status is 'ok' or no limit: proceed normally.
        - If status is 'warning': log warning on chatter, proceed.
        - If status is 'blocked': raise UserError unless:
            a) Manager group user confirms
            b) Credit override context is set
        """
        for order in self:
            # Skip credit check if override context is set
            if self.env.context.get('credit_override'):
                continue

            partner    = order.partner_id.commercial_partner_id
            credit_limit = partner.credit_limit

            # No limit configured — skip check
            if credit_limit <= 0:
                continue

            allowed, message = partner.can_place_order(order.amount_total)

            if not allowed:
                # Blocked — check if user is manager
                if self.env.user.has_group(
                    'electrical_store_base.group_electrical_manager'
                ):
                    # Manager can proceed but must log reason
                    order._open_credit_override_wizard()
                    return False  # Wizard will confirm the order

                # Non-manager — raise hard error
                raise UserError(_(
                    'Cannot confirm order.\n\n'
                    '%(message)s\n\n'
                    'Please contact the manager to override the credit block.',
                    message=message,
                ))

            if message:
                # Warning — log on chatter and continue
                order.message_post(
                    body=_(
                        '⚠️ Credit Warning / تحذير ائتماني\n\n%(message)s',
                        message=message,
                    ),
                    message_type='notification',
                )

        return super().action_confirm()

    # -------------------------------------------------------------------------
    # Credit Override Wizard Launcher
    # -------------------------------------------------------------------------

    def _open_credit_override_wizard(self):
        """Open credit warning wizard for manager to provide override reason."""
        self.ensure_one()
        return {
            'type':      'ir.actions.act_window',
            'name':      'Credit Override Required / تجاوز الحد الائتماني',
            'res_model': 'credit.warning.wizard',
            'view_mode': 'form',
            'target':    'new',
            'context': {
                'default_sale_order_id': self.id,
                'default_partner_id':    self.partner_id.commercial_partner_id.id,
            },
        }

    def action_open_credit_override(self):
        """Button action to open credit override wizard manually."""
        self.ensure_one()
        return self._open_credit_override_wizard()

    # -------------------------------------------------------------------------
    # RPC: Credit Check for POS/External Use
    # -------------------------------------------------------------------------

    @api.model
    def _check_credit_limit_for_partner(self, partner_id, amount):
        """
        API method for POS and external credit check.

        :param partner_id: int — res.partner ID
        :param amount:     float — order amount to check
        :returns: dict — {allowed, status, message}
        """
        if not partner_id:
            return {'allowed': True, 'status': 'ok', 'message': ''}

        partner = self.env['res.partner'].browse(partner_id)
        if not partner.exists():
            return {'allowed': True, 'status': 'ok', 'message': ''}

        commercial = partner.commercial_partner_id

        if commercial.credit_limit <= 0:
            return {'allowed': True, 'status': 'ok', 'message': ''}

        allowed, message = commercial.can_place_order(amount)
        status = commercial.credit_status

        if not allowed:
            return {
                'allowed': False,
                'status':  'blocked',
                'message': message,
            }

        if message:
            return {
                'allowed': True,
                'status':  'warning',
                'message': message,
            }

        return {
            'allowed': True,
            'status':  'ok',
            'message': '',
        }