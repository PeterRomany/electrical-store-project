# -*- coding: utf-8 -*-
{
    'name': 'Inventory Damage Management',
    'version': '18.0.1.0.0',
    'category': 'Inventory/Damage',
    'summary': 'Damage reason tracking, reports, and statistics for scrap operations',
    'description': """
        Inventory Damage Management Module
        ===================================
        Extends standard Odoo stock.scrap with:

        Features:
        ---------
        - Damage reason classification (mandatory on scrap)
        - Damage notes field
        - Predefined damage reason categories:
            * Physical Damage / تلف مادي
            * Water Damage / تلف مائي
            * Electrical Fault / عطل كهربائي
            * Expired / منتهي الصلاحية
            * Missing / مفقود
            * Return Damage / تلف مرتجعات
            * Manufacturing Defect / عيب تصنيع
            * Other / أخرى
        - Damage report by reason, product, period
        - Damage statistics in dashboard
        - Arabic labels and messages
        - Full security group integration
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'electrical_store_base',
        'stock',
        'mail',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',

        # Master Data
        'data/damage_reason_data.xml',

        # Views
        'views/damage_reason_views.xml',
        'views/stock_scrap_views.xml',
        'views/damage_report_views.xml',
        'views/menus.xml',

        # Reports
        'report/damage_report_action.xml',
        'report/damage_report_template.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'sequence': 4,
}