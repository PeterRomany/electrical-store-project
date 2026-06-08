# -*- coding: utf-8 -*-
{
    'name': 'Electrical Store POS',
    'version': '18.0.1.0.0',
    'category': 'Point of Sale/Electrical',
    'summary': 'POS extensions for electrical supplies store (Egypt)',
    'description': """
        Electrical Store POS Custom Module
        ===================================
        Extends the standard Odoo 18 POS — does NOT rebuild POS.

        Features:
        ---------
        - Arabic product search (name, alias, keywords)
        - Barcode search
        - Product alias search
        - Customer credit limit warning and block
        - Customer balance display in POS
        - Stock quantity display on product card
        - Brand, Watt, Voltage display
        - Packaging unit selector (Piece, Box, Carton, Pack, Meter, Roll)
        - Fast barcode checkout workflow
        - Return and refund support
        - Full RTL Arabic UI support
        - Customer type display
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'electrical_store_base',
        'point_of_sale',
        'stock',
        'account',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/pos_config_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            # CSS — load first
            'electrical_pos_custom/static/src/css/electrical_pos.css',

            # JS — Models / Services
            'electrical_pos_custom/static/src/js/models/electrical_product_model.js',

            # JS — Components
            'electrical_pos_custom/static/src/js/components/ArabicSearchBar/ArabicSearchBar.js',
            'electrical_pos_custom/static/src/js/components/CustomerCreditWidget/CustomerCreditWidget.js',
            'electrical_pos_custom/static/src/js/components/ProductInfoPopup/ProductInfoPopup.js',
            'electrical_pos_custom/static/src/js/components/PackagingSelectorPopup/PackagingSelectorPopup.js',
            'electrical_pos_custom/static/src/js/components/ElectricalProductCard/ElectricalProductCard.js',

            # JS — Patches (extend existing POS components)
            'electrical_pos_custom/static/src/js/patches/ProductScreen.patch.js',
            'electrical_pos_custom/static/src/js/patches/PaymentScreen.patch.js',
            'electrical_pos_custom/static/src/js/patches/PartnerList.patch.js',

            # XML Templates
            'electrical_pos_custom/static/src/xml/ArabicSearchBar.xml',
            'electrical_pos_custom/static/src/xml/CustomerCreditWidget.xml',
            'electrical_pos_custom/static/src/xml/ProductInfoPopup.xml',
            'electrical_pos_custom/static/src/xml/PackagingSelectorPopup.xml',
            'electrical_pos_custom/static/src/xml/ElectricalProductCard.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'sequence': 2,
}
