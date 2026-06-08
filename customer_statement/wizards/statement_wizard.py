# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import UserError


class CustomerStatementWizard(models.TransientModel):
    """
    Customer Account Statement Wizard
    ===================================
    Generates a detailed account statement for a customer
    showing all transactions within a selected date range.
    """
    _name        = 'customer.statement.wizard'
    _description = 'Customer Account Statement / كشف حساب العميل'

    # -------------------------------------------------------------------------
    # Fields
    # -------------------------------------------------------------------------

    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Customer / العميل',
        required=True,
        domain=[('customer_rank', '>', 0)],
        help='Select the customer to generate the statement for.',
    )
    date_from = fields.Date(
        string='From Date / من تاريخ',
        required=True,
        default=lambda self: fields.Date.today().replace(day=1),
        help='Start date of the statement period.',
    )
    date_to = fields.Date(
        string='To Date / إلى تاريخ',
        required=True,
        default=fields.Date.today,
        help='End date of the statement period.',
    )
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Currency / العملة',
        default=lambda self: self.env.company.currency_id,
        readonly=True,
    )
    company_id = fields.Many2one(
        comodel_name='res.company',
        string='Company',
        default=lambda self: self.env.company,
        readonly=True,
    )
    include_unreconciled_only = fields.Boolean(
        string='Unreconciled Only / غير المسدد فقط',
        default=False,
        help='Show only transactions with outstanding balance.',
    )
    include_internal_notes = fields.Boolean(
        string='Include Notes / تضمين الملاحظات',
        default=True,
        help='Include internal notes on the statement.',
    )

    # -------------------------------------------------------------------------
    # Computed Summary Fields (for wizard display)
    # -------------------------------------------------------------------------

    opening_balance = fields.Float(
        string='Opening Balance / الرصيد الافتتاحي',
        compute='_compute_statement_summary',
        digits=(16, 2),
    )
    total_debits = fields.Float(
        string='Total Debits / إجمالي المديونية',
        compute='_compute_statement_summary',
        digits=(16, 2),
    )
    total_credits = fields.Float(
        string='Total Credits / إجمالي الدائنية',
        compute='_compute_statement_summary',
        digits=(16, 2),
    )
    closing_balance = fields.Float(
        string='Closing Balance / الرصيد الختامي',
        compute='_compute_statement_summary',
        digits=(16, 2),
    )
    transaction_count = fields.Integer(
        string='Transactions / عدد الحركات',
        compute='_compute_statement_summary',
    )

    # -------------------------------------------------------------------------
    # Compute Summary
    # -------------------------------------------------------------------------

    @api.depends(
        'partner_id',
        'date_from',
        'date_to',
        'include_unreconciled_only',
    )
    def _compute_statement_summary(self):
        for wizard in self:
            if not wizard.partner_id or not wizard.date_from or not wizard.date_to:
                wizard.opening_balance  = 0.0
                wizard.total_debits     = 0.0
                wizard.total_credits    = 0.0
                wizard.closing_balance  = 0.0
                wizard.transaction_count = 0
                continue

            opening = wizard._get_opening_balance()
            lines   = wizard._get_statement_lines()

            total_debits  = sum(l['debit']  for l in lines)
            total_credits = sum(l['credit'] for l in lines)

            wizard.opening_balance   = opening
            wizard.total_debits      = total_debits
            wizard.total_credits     = total_credits
            wizard.closing_balance   = opening + total_debits - total_credits
            wizard.transaction_count = len(lines)

    # -------------------------------------------------------------------------
    # Core: Opening Balance
    # -------------------------------------------------------------------------

    def _get_opening_balance(self):
        """
        Calculate outstanding balance BEFORE date_from.
        Includes all posted invoices, credit notes, and payments
        before the statement period.

        :returns: float — opening balance (positive = customer owes)
        """
        self.ensure_one()
        partner = self.partner_id.commercial_partner_id

        moves = self.env['account.move'].search([
            ('partner_id',  'child_of', partner.id),
            ('state',       '=',        'posted'),
            ('date',        '<',        self.date_from),
            ('move_type',   'in',       (
                'out_invoice',
                'out_refund',
                'out_receipt',
            )),
        ])

        opening = 0.0
        for move in moves:
            if move.move_type in ('out_invoice', 'out_receipt'):
                opening += move.amount_total
            elif move.move_type == 'out_refund':
                opening -= move.amount_total

        # Subtract payments made before date_from
        payments = self.env['account.payment'].search([
            ('partner_id',   'child_of', partner.id),
            ('state',        '=',        'posted'),
            ('date',         '<',        self.date_from),
            ('payment_type', '=',        'inbound'),
        ])
        opening -= sum(payments.mapped('amount'))

        return opening

    # -------------------------------------------------------------------------
    # Core: Statement Lines
    # -------------------------------------------------------------------------

    def _get_statement_lines(self):
        """
        Build ordered list of statement lines within the date range.
        Each line represents one journal entry (invoice, credit note, payment).

        :returns: list of dicts with keys:
            date, name, ref, move_type, type_label,
            debit, credit, balance, payment_state, amount_residual
        """
        self.ensure_one()
        partner = self.partner_id.commercial_partner_id

        # Build domain
        domain = [
            ('partner_id',  'child_of', partner.id),
            ('state',       '=',        'posted'),
            ('date',        '>=',       self.date_from),
            ('date',        '<=',       self.date_to),
            ('move_type',   'in',       (
                'out_invoice',
                'out_refund',
                'out_receipt',
            )),
        ]

        if self.include_unreconciled_only:
            domain.append(
                ('payment_state', 'not in', ('paid', 'reversed', 'cancelled'))
            )

        moves = self.env['account.move'].search(
            domain,
            order='date asc, name asc',
        )

        # Also include inbound payments within period
        payment_domain = [
            ('partner_id',   'child_of', partner.id),
            ('state',        '=',        'posted'),
            ('date',         '>=',       self.date_from),
            ('date',         '<=',       self.date_to),
            ('payment_type', '=',        'inbound'),
        ]
        payments = self.env['account.payment'].search(
            payment_domain,
            order='date asc',
        )

        lines      = []
        running_bal = self._get_opening_balance()

        # Process invoices / credit notes
        for move in moves:
            type_labels = {
                'out_invoice': ('فاتورة مبيعات', 'Sales Invoice'),
                'out_receipt': ('إيصال', 'Receipt'),
                'out_refund':  ('إشعار دائن', 'Credit Note'),
            }
            ar_label, en_label = type_labels.get(
                move.move_type,
                ('حركة', 'Move'),
            )

            if move.move_type in ('out_invoice', 'out_receipt'):
                debit  = move.amount_total
                credit = 0.0
            else:
                debit  = 0.0
                credit = move.amount_total

            running_bal += debit - credit

            lines.append({
                'date':            move.date,
                'name':            move.name or '',
                'ref':             move.ref or '',
                'move_type':       move.move_type,
                'type_label_ar':   ar_label,
                'type_label_en':   en_label,
                'debit':           debit,
                'credit':          credit,
                'balance':         running_bal,
                'payment_state':   move.payment_state or '',
                'amount_residual': move.amount_residual or 0.0,
                'is_payment':      False,
            })

        # Process payments (sorted by date, interleave with invoices)
        for payment in payments:
            running_bal -= payment.amount
            lines.append({
                'date':            payment.date,
                'name':            payment.name or '',
                'ref':             payment.ref or '',
                'move_type':       'payment',
                'type_label_ar':   'دفعة مستلمة',
                'type_label_en':   'Payment Received',
                'debit':           0.0,
                'credit':          payment.amount,
                'balance':         running_bal,
                'payment_state':   'paid',
                'amount_residual': 0.0,
                'is_payment':      True,
            })

        # Re-sort all lines by date
        lines.sort(key=lambda l: (str(l['date']), l['name']))

        # Recompute running balance after sort
        running_bal = self._get_opening_balance()
        for line in lines:
            running_bal      += line['debit'] - line['credit']
            line['balance']   = running_bal

        return lines

    # -------------------------------------------------------------------------
    # Constraints
    # -------------------------------------------------------------------------

    @api.constrains('date_from', 'date_to')
    def _check_dates(self):
        for wizard in self:
            if wizard.date_from and wizard.date_to:
                if wizard.date_from > wizard.date_to:
                    raise UserError(_(
                        'From Date cannot be after To Date.\n'
                        'تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.'
                    ))

    # -------------------------------------------------------------------------
    # Actions
    # -------------------------------------------------------------------------

    def action_print_statement(self):
        """Print PDF statement."""
        self.ensure_one()
        if self.date_from > self.date_to:
            raise UserError(_(
                'From Date must be before To Date.\n'
                'يجب أن يكون تاريخ البداية قبل تاريخ النهاية.'
            ))
        if not self.transaction_count and not self.opening_balance:
            raise UserError(_(
                'No transactions found for this customer in the selected period.\n'
                'لا توجد حركات لهذا العميل في الفترة المحددة.'
            ))
        return self.env.ref(
            'customer_statement.action_report_customer_statement'
        ).report_action(self)

    def action_send_by_email(self):
        """Send PDF statement to customer by email."""
        self.ensure_one()

        report    = self.env.ref(
            'customer_statement.action_report_customer_statement'
        )
        pdf_data, _ = report._render_qweb_pdf(self.ids)

        attachment = self.env['ir.attachment'].create({
            'name':      (
                f'Statement_{self.partner_id.name}_'
                f'{self.date_from}_{self.date_to}.pdf'
            ),
            'type':      'binary',
            'datas':     pdf_data,
            'res_model': self._name,
            'res_id':    self.id,
            'mimetype':  'application/pdf',
        })

        return {
            'type':      'ir.actions.act_window',
            'name':      _('Send Statement by Email'),
            'res_model': 'mail.compose.message',
            'view_mode': 'form',
            'target':    'new',
            'context': {
                'default_model':          self._name,
                'default_res_ids':        [self.id],
                'default_partner_ids':    [self.partner_id.id],
                'default_attachment_ids': [attachment.id],
                'default_subject': (
                    f'كشف حساب — {self.partner_id.name} — '
                    f'{self.date_from} إلى {self.date_to}'
                ),
                'default_body': (
                    f'<p dir="rtl">عزيزي العميل {self.partner_id.name}،</p>'
                    f'<p dir="rtl">يرجى الاطلاع على كشف حسابكم المرفق للفترة من '
                    f'{self.date_from} إلى {self.date_to}.</p>'
                    f'<p dir="rtl">لأي استفسار، يرجى التواصل معنا.</p>'
                ),
            },
        }