# -*- coding: utf-8 -*-
{
    'name': 'كشف حساب العملاء',
    'version': '18.0.1.0.0',
    'category': 'Accounting/Reports',
    'summary': 'Customer account statement with outstanding balance and PDF export',
    'description': """
        Customer Statement Module
        =========================
        Provides customer account statements for the electrical store.

        Features:
        ---------
        - Customer account statement wizard
        - Date range selection
        - Opening balance calculation
        - Transaction listing:
            * Invoices (debits)
            * Credit notes (credits)
            * Payments applied
        - Running balance per transaction
        - Closing balance
        - Outstanding balance display
        - Credit limit summary
        - Customer type display
        - PDF export (Arabic + English bilingual)
        - Email statement to customer
        - Filter: unreconciled only
        - Security: Accountant and Manager only
        - Full Arabic RTL support
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'electrical_store_base',
        'customer_credit_limit',
        'account',
        'accounting_pdf_reports',
        'mail',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',

        # Wizards
        'wizards/statement_wizard_views.xml',

        # Reports
        'report/customer_statement_report_action.xml',
        'report/customer_statement_report_template.xml',

        # Menus
        'views/menus.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'sequence': 5,
}
