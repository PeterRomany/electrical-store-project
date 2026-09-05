# -*- coding: utf-8 -*-
{
    'name': 'أساس محل الكهرباء',
    'version': '18.0.1.0.0',
    'category': 'Inventory/Electrical',
    'summary': 'Core product extensions for electrical supplies store (Egypt)',
    'description': """
        Electrical Store Base Module
        ============================
        Extends standard Odoo product, partner, and UoM models with:
        - Product Brand
        - Watt / Voltage specifications
        - Shelf Location
        - Product Alias names
        - Arabic search keywords
        - Customer types (Retail, Electrician, Contractor, Company)
        - Units of Measure: Roll, Box, Carton, Pack
        - Product categories for electrical supplies
        - Security groups: Cashier, Store Keeper, Accountant, Manager
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'base',
        'product',
        'stock',
        'sale_management',
        'purchase',
        'point_of_sale',
        'uom',
        'contacts',
        'mail',
    ],
    'data': [
        # Security — always first
        'security/electrical_store_groups.xml',
        'security/ir.model.access.csv',

        # Master data
        'data/uom_category_data.xml',
        'data/uom_data.xml',
        'data/product_category_data.xml',

        # Views
        'views/electrical_brand_views.xml',
        'views/product_template_views.xml',
        'views/res_partner_views.xml',
        'views/menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'electrical_store_base/static/src/css/electrical_store_backend.css',
        ],
    },
    'demo': [],
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
    'sequence': 1,
}
