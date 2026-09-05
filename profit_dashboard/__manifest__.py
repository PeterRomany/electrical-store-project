# -*- coding: utf-8 -*-
{
    'name': 'لوحة متابعة المحل',
    'version': '18.0.1.0.0',
    'category': 'Reporting/Dashboard',
    'summary': 'Real-time profit and performance dashboard for electrical store',
    'description': """
        Profit Dashboard Module
        =======================
        Provides a real-time management dashboard for the electrical store.

        Dashboard Widgets:
        ------------------
        - Daily Sales Total / مجموع مبيعات اليوم
        - Monthly Sales Total / مجموع مبيعات الشهر
        - Gross Profit (%) / الربح الإجمالي
        - Top 10 Products by Revenue / أفضل 10 منتجات
        - Top 10 Customers by Revenue / أفضل 10 عملاء
        - Damaged Inventory Value / قيمة المخزون التالف
        - Low Stock Alerts / تنبيهات المخزون المنخفض
        - POS Sessions Summary / ملخص جلسات نقطة البيع
        - Monthly Sales Trend Chart / مخطط اتجاه المبيعات الشهري
        - Sales by Customer Type / المبيعات حسب نوع العميل

        Technical:
        ----------
        - OWL client action component
        - JSON RPC controller
        - Auto-refresh every 5 minutes
        - Responsive RTL Arabic layout
        - Drill-down to detail views
        - Date range selector
    """,
    'author': 'Electrical Store ERP',
    'website': '',
    'depends': [
        'electrical_store_base',
        'customer_credit_limit',
        'customer_statement',
        'inventory_damage_management',
        'sale_management',
        'purchase',
        'point_of_sale',
        'stock',
        'account',
        'web',
    ],
    'data': [
        # Security
        'security/ir.model.access.csv',

        # Views
        'views/dashboard_action.xml',
        'views/menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            # CSS
            'profit_dashboard/static/src/css/profit_dashboard.css',

            # JS — Controller / Service
            'profit_dashboard/static/src/js/profit_dashboard_service.js',

            # JS — Components
            'profit_dashboard/static/src/js/components/KpiCard/KpiCard.js',
            'profit_dashboard/static/src/js/components/SalesChart/SalesChart.js',
            'profit_dashboard/static/src/js/components/TopProductsTable/TopProductsTable.js',
            'profit_dashboard/static/src/js/components/TopProductsTable/TopCustomersTable.js',
            'profit_dashboard/static/src/js/components/LowStockAlert/LowStockAlert.js',
            'profit_dashboard/static/src/js/components/DamageWidget/DamageWidget.js',

            # JS — Main Dashboard
            'profit_dashboard/static/src/js/profit_dashboard.js',

            # XML Templates
            'profit_dashboard/static/src/xml/KpiCard.xml',
            'profit_dashboard/static/src/xml/SalesChart.xml',
            'profit_dashboard/static/src/xml/TopProductsTable.xml',
            'profit_dashboard/static/src/xml/TopCustomersTable.xml',
            'profit_dashboard/static/src/xml/LowStockAlert.xml',
            'profit_dashboard/static/src/xml/DamageWidget.xml',
            'profit_dashboard/static/src/xml/profit_dashboard.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'sequence': 6,
}
