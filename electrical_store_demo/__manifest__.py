# -*- coding: utf-8 -*-
{
    'name': 'بيانات تجربة محل الكهرباء',
    'version': '18.0.1.0.0',
    'category': 'Inventory/Electrical',
    'summary': 'بيانات تجريبية جاهزة لاختبار نظام محل الكهرباء',
    'depends': [
        'electrical_store_base',
        'customer_credit_limit',
        'electrical_pos_custom',
        'inventory_damage_management',
        'customer_statement',
        'profit_dashboard',
    ],
    'data': [
        'data/electrical_store_demo_data.xml',
        'data/electrical_store_demo_images.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
