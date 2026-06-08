# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError


class CreditWarningWizard(models.TransientModel):
    """
    Credit Warning Wizard
    =====================
    Shown when a manager tries to confirm a sale order for a
    credit-blocked customer. Requires override reason before proceeding.
    """
    _name        = 'credit.warning.wizard'
    _description = 'Credit Limit Warning / تحذير الحد الائتماني'

    # -------------------------------------------------------------------------
    # Fields
    # -------------------------------------------------------------------------

    sale_order_id = fields.Many2one(
        comodel_name='sale.order',
        string='Sale Order / أمر البيع',
        readonly=True,
        ondelete='cascade',
    )
    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Customer / العميل',
        readonly=True,
    )

    # Credit info — readonly display
    credit_limit = fields.Float(
        string='Credit Limit / الحد الائتماني',
        related='partner_id.credit_limit',
        readonly=True,
        digits=(16, 2),
    )
    credit_used = fields.Float(
        string='Credit Used / الرصيد المستخدم',
        related='partner_id.credit_used',
        readonly=True,
        digits=(16, 2),
    )
    credit_available = fields.Float(
        string='Credit Available / الرصيد المتاح',
        related='partner_id.credit_available',
        readonly=True,
        digits=(16, 2),
    )
    credit_usage_pct = fields.Float(
        string='Usage (%) / نسبة الاستخدام',
        related='partner_id.credit_usage_pct',
        readonly=True,
        digits=(5, 2),
    )
    credit_status = fields.Selection(
        related='partner_id.credit_status',
        string='Status / الحالة',
        readonly=True,
    )

    # Order info
    order_amount = fields.Float(
        string='Order Amount / قيمة الطلب',
        readonly=True,
        digits=(16, 2),
    )
    projected_used = fields.Float(
        string='Projected Used / الرصيد المتوقع',
        compute='_compute_projected',
        readonly=True,
        digits=(16, 2),
    )
    projected_pct = fields.Float(
        string='Projected Usage (%) / النسبة المتوقعة',
        compute='_compute_projected',
        readonly=True,
        digits=(5, 2),
    )

    # Override fields
    override_reason = fields.Text(
        string='Override Reason / سبب التجاوز',
        required=True,
        help='Mandatory reason for overriding the credit block. '
             'Will be logged on the sale order chatter.',
    )

    # -------------------------------------------------------------------------
    # Defaults
    # -------------------------------------------------------------------------

    @api.model
    def default_get(self, fields_list):
        result = super().default_get(fields_list)

        order_id = self.env.context.get('default_sale_order_id')
        if order_id:
            order = self.env['sale.order'].browse(order_id)
            if order.exists():
                result['sale_order_id'] = order.id
                result['order_amount']  = order.amount_total
                if 'partner_id' not in result:
                    result['partner_id'] = (
                        order.partner_id.commercial_partner_id.id
                    )

        return result

    # -------------------------------------------------------------------------
    # Compute
    # -------------------------------------------------------------------------

    @api.depends('credit_used', 'order_amount', 'credit_limit')
    def _compute_projected(self):
        for wizard in self:
            wizard.projected_used = wizard.credit_used + wizard.order_amount
            if wizard.credit_limit > 0:
                wizard.projected_pct = (
                    wizard.projected_used / wizard.credit_limit
                ) * 100.0
            else:
                wizard.projected_pct = 0.0

    # -------------------------------------------------------------------------
    # Actions
    # -------------------------------------------------------------------------

    def action_override_and_confirm(self):
        """
        Manager override: confirm sale order despite credit block.
        Logs override reason and confirming user on order chatter.
        Only allowed for users in Manager group.
        """
        self.ensure_one()

        # Security check — only managers can override
        if not self.env.user.has_group(
            'electrical_store_base.group_electrical_manager'
        ):
            raise AccessError(_(
                'Only a Manager can override a credit block.\n'
                'فقط المدير يمكنه تجاوز حظر الائتمان.'
            ))

        if not self.override_reason or not self.override_reason.strip():
            raise UserError(_(
                'Override reason is required.\n'
                'يجب إدخال سبب التجاوز.'
            ))

        order = self.sale_order_id
        if not order or not order.exists():
            raise UserError(_('Sale order not found.'))

        # Log override on order chatter
        order.write({
            'credit_override_reason':  self.override_reason.strip(),
            'credit_override_user_id': self.env.user.id,
        })

        order.message_post(
            body=_(
                '🔓 Credit Block Overridden / تم تجاوز حظر الائتمان\n\n'
                'Overridden by / بواسطة: %(user)s\n'
                'Reason / السبب: %(reason)s\n\n'
                'Credit Used / الرصيد المستخدم: %(used).2f\n'
                'Credit Limit / الحد الائتماني: %(limit).2f\n'
                'Order Amount / قيمة الطلب: %(amount).2f',
                user=self.env.user.name,
                reason=self.override_reason.strip(),
                used=self.credit_used,
                limit=self.credit_limit,
                amount=self.order_amount,
            ),
            message_type='notification',
            subtype_xmlid='mail.mt_note',
        )

        # Confirm order with override context to bypass credit check
        order.with_context(credit_override=True).action_confirm()

        return {
            'type':   'ir.actions.act_window_close',
        }

    def action_cancel(self):
        """Cancel wizard — do not confirm the order."""
        return {'type': 'ir.actions.act_window_close'}