# -*- coding: utf-8 -*-
{
    'name': 'Customer Credit Limit',
    'version': '18.0.1.0.0',
    'category': 'Sales/Credit',
    'summary': 'Credit limit, warning threshold, and blocking for customers',
    'description': """
        Customer Credit Limit Module
        ============================
        Extends standard Odoo partner, sale order, and POS with:

        Features:
        ---------
        - Credit limit per customer
        - Warning threshold (%) — shows alert when approaching limit
        - Blocking threshold (%) — blocks sale/POS when exceeded
        - Real-time credit used (computed from unpaid invoices)
        - Credit available (computed)
        - Credit status: OK / Warning / Blocked
        - Sale Order confirmation validation
        - POS payment validation
        - Manager override with reason logging
        - Credit warning wizard for sale orders
        - Arabic labels and messages
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'electrical_store_base',
        'sale_management',
        'account',
        'point_of_sale',
        'mail',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',

        # Wizards
        'wizards/credit_warning_wizard_views.xml',

        # Views
        'views/res_partner_views.xml',
        'views/sale_order_views.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'sequence': 3,
}