# -*- coding: utf-8 -*-
from odoo import models


class PosSession(models.Model):
    _inherit = 'pos.session'

    # -------------------------------------------------------------------------
    # Load Electrical Product Data into POS
    # -------------------------------------------------------------------------

    def _loader_params_product_product(self):
        """
        Extend standard product loader to include electrical fields.
        These fields will be available on pos.product in the frontend.
        """
        result = super()._loader_params_product_product()
        result['search_params']['fields'].extend([
            'brand_id',
            'watt',
            'voltage',
            'warranty_months',
            'shelf_location',
            'product_alias',
            'arabic_keywords',
        ])
        return result

    def _loader_params_product_packaging(self):
        """
        Load product packaging with electrical fields.
        """
        result = super()._loader_params_product_packaging()
        result['search_params']['fields'].extend([
            'packaging_type',
            'arabic_name',
        ])
        return result

    def _get_pos_ui_res_partner(self, params):
        """
        Extend partner data loaded into POS to include
        customer_type and credit fields.
        """
        partners = super()._get_pos_ui_res_partner(params)
        # Augment each partner with electrical store fields
        partner_ids = [p['id'] for p in partners]
        partner_records = self.env['res.partner'].browse(partner_ids)
        partner_map = {p.id: p for p in partner_records}

        for partner_dict in partners:
            record = partner_map.get(partner_dict['id'])
            if record:
                partner_dict['customer_type'] = record.customer_type or 'retail'
                partner_dict['credit_limit'] = record.credit_limit or 0.0
                partner_dict['credit_used'] = record.credit_used or 0.0
                partner_dict['credit_available'] = record.credit_available or 0.0
                partner_dict['credit_status'] = record.credit_status or 'ok'
                partner_dict['warning_threshold'] = record.warning_threshold or 80.0
                partner_dict['blocking_threshold'] = record.blocking_threshold or 100.0

        return partners

    def _get_pos_ui_electrical_brands(self, params):
        """
        Load all active electrical brands into POS session.
        """
        brands = self.env['electrical.brand'].search_read(
            domain=[('active', '=', True)],
            fields=['id', 'name', 'name_arabic', 'country_of_origin'],
            order='name asc',
        )
        return brands

    def get_pos_ui_electrical_pos_custom(self, params):
        """
        Entry point called by POS to load all electrical custom data.
        """
        return {
            'config': self.config_id._get_pos_ui_electrical_pos_custom(params),
            'brands': self._get_pos_ui_electrical_brands(params),
        }