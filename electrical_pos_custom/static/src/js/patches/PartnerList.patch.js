/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { PartnerList } from "@point_of_sale/app/screens/partner_list/partner_list";
import { useService } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useState } from "@odoo/owl";
import { CustomerCreditWidget } from "@electrical_pos_custom/js/components/CustomerCreditWidget/CustomerCreditWidget";

// =============================================================================
// PartnerList Patch
// Extends standard POS PartnerList with:
// - Arabic customer name search
// - Customer type filter
// - Credit status display on partner rows
// - CustomerCreditWidget on partner selection
// - RTL layout support
// =============================================================================

patch(PartnerList.prototype, {

    // -------------------------------------------------------------------------
    // Setup
    // -------------------------------------------------------------------------

    setup() {
        super.setup();

        this.pos          = usePos();
        this.orm          = useService("orm");
        this.notification = useService("notification");

        this.partnerState = useState({
            searchTerm:         '',
            selectedTypeFilter: 'all',
            selectedPartner:    null,
            creditInfo:         null,
            loadingCredit:      false,
        });
    },

    // -------------------------------------------------------------------------
    // Search Override
    // -------------------------------------------------------------------------

    /**
     * Extended partner search supporting:
     * - Arabic name
     * - Phone
     * - Customer type
     * - Credit status
     *
     * @param {string} term
     * @returns {Array}
     */
    getFilteredPartners(term) {
        const allPartners = this.pos.models['res.partner']?.getAll() || [];
        const typeFilter  = this.partnerState.selectedTypeFilter;

        return allPartners.filter(partner => {
            // Type filter
            if (typeFilter !== 'all') {
                if ((partner.customer_type || 'retail') !== typeFilter) {
                    return false;
                }
            }

            // Text search
            if (!term || term.trim() === '') return true;

            const lterm = term.trim().toLowerCase();
            const searchable = [
                partner.name        || '',
                partner.phone       || '',
                partner.mobile      || '',
                partner.email       || '',
                partner.ref         || '',
                partner.customer_type || '',
            ].join(' ').toLowerCase();

            return searchable.includes(lterm);
        });
    },

    /**
     * Handle search input change.
     * @param {Event} ev
     */
    onSearchInput(ev) {
        this.partnerState.searchTerm = ev.target.value || '';
    },

    /**
     * Clear search term.
     */
    clearSearch() {
        this.partnerState.searchTerm = '';
    },

    // -------------------------------------------------------------------------
    // Customer Type Filter
    // -------------------------------------------------------------------------

    /**
     * Set active customer type filter.
     * @param {string} type — 'all'|'retail'|'electrician'|'contractor'|'company'
     */
    setTypeFilter(type) {
        this.partnerState.selectedTypeFilter = type;
    },

    /**
     * Returns CSS class for a type filter button.
     * @param {string} type
     * @returns {string}
     */
    getTypeFilterClass(type) {
        const active = this.partnerState.selectedTypeFilter === type;
        return active
            ? 'btn btn-sm btn-primary'
            : 'btn btn-sm btn-outline-secondary';
    },

    // -------------------------------------------------------------------------
    // Partner Selection with Credit Info
    // -------------------------------------------------------------------------

    /**
     * Handle partner selection from list.
     * Loads credit info and shows CustomerCreditWidget.
     *
     * @param {object} partner
     */
    async onPartnerSelect(partner) {
        this.partnerState.selectedPartner = partner;
        await this._loadPartnerCredit(partner);
    },

    /**
     * Load credit info for selected partner.
     * @param {object} partner
     */
    async _loadPartnerCredit(partner) {
        if (!partner?.id) {
            this.partnerState.creditInfo = null;
            return;
        }

        this.partnerState.loadingCredit = true;

        try {
            const info = await this.orm.call(
                'pos.order',
                'get_customer_credit_info',
                [partner.id],
                {}
            );
            this.partnerState.creditInfo = info || null;
        } catch {
            // Use cached partner data
            this.partnerState.creditInfo = {
                id:                 partner.id,
                name:               partner.name || '',
                customer_type:      partner.customer_type || 'retail',
                credit_limit:       partner.credit_limit || 0.0,
                credit_used:        partner.credit_used || 0.0,
                credit_available:   partner.credit_available || 0.0,
                credit_status:      partner.credit_status || 'ok',
                warning_threshold:  partner.warning_threshold || 80.0,
                blocking_threshold: partner.blocking_threshold || 100.0,
            };
        } finally {
            this.partnerState.loadingCredit = false;
        }
    },

    /**
     * Confirm partner selection and apply to current order.
     * Blocks selection if customer is credit-blocked (without override).
     */
    async confirmPartnerSelection() {
        const partner = this.partnerState.selectedPartner;
        if (!partner) return;

        const creditInfo = this.partnerState.creditInfo;
        const isBlocked  = creditInfo?.credit_status === 'blocked';

        if (isBlocked && this.pos.config?.iface_credit_warning) {
            const { confirmed } = await this.popup.add('ConfirmPopup', {
                title:       '🚫 عميل محظور',
                body:
                    `العميل ${partner.name} تجاوز الحد الائتماني.\n` +
                    `هل تريد الاستمرار؟ (يلزم موافقة المدير عند الدفع)`,
                confirmText: 'استمرار مع التحذير',
                cancelText:  'اختيار عميل آخر',
            });

            if (!confirmed) return;
        }

        // Apply partner to order using standard method
        this.props.partner = partner;
        this.pos.get_order()?.set_partner(partner);
        this.props.close({ confirmed: true, payload: partner });
    },

    /**
     * Cancel partner selection.
     */
    cancelPartnerSelection() {
        this.props.close({ confirmed: false });
    },

    // -------------------------------------------------------------------------
    // Computed Properties
    // -------------------------------------------------------------------------

    /**
     * Filtered and sorted partner list.
     * @returns {Array}
     */
    get electricalPartnerList() {
        const partners = this.getFilteredPartners(
            this.partnerState.searchTerm
        );
        // Sort: customers first, then by name
        return partners.sort((a, b) => {
            if (a.customer_rank > 0 && b.customer_rank === 0) return -1;
            if (a.customer_rank === 0 && b.customer_rank > 0) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    },

    /**
     * Currently selected partner object.
     * @returns {object|null}
     */
    get selectedPartner() {
        return this.partnerState.selectedPartner;
    },

    /**
     * Credit info for selected partner.
     * @returns {object|null}
     */
    get selectedPartnerCredit() {
        return this.partnerState.creditInfo;
    },

    /**
     * Whether credit info is loading.
     * @returns {boolean}
     */
    get isLoadingCredit() {
        return this.partnerState.loadingCredit;
    },

    /**
     * Returns Arabic customer type label.
     * @param {string} type
     * @returns {string}
     */
    getCustomerTypeLabel(type) {
        const labels = {
            retail:      'تجزئة',
            electrician: 'كهربائي',
            contractor:  'مقاول',
            company:     'شركة',
        };
        return labels[type] || 'تجزئة';
    },

    /**
     * Returns CSS class for customer type badge on partner row.
     * @param {string} type
     * @returns {string}
     */
    getCustomerTypeBadgeClass(type) {
        return `customer-type-badge ${type || 'retail'}`;
    },

    /**
     * Returns credit status icon for partner row.
     * @param {object} partner
     * @returns {string}
     */
    getCreditStatusIcon(partner) {
        const status = partner.credit_status || 'ok';
        const icons  = {
            ok:      '✅',
            warning: '⚠️',
            blocked: '🚫',
        };
        return icons[status] || '✅';
    },

    /**
     * Returns CSS class for partner row based on credit status.
     * @param {object} partner
     * @returns {string}
     */
    getPartnerRowClass(partner) {
        const status    = partner.credit_status || 'ok';
        const isSelected = this.partnerState.selectedPartner?.id === partner.id;
        let cls = 'partner-row';
        if (isSelected)          cls += ' selected';
        if (status === 'blocked') cls += ' partner-blocked';
        if (status === 'warning') cls += ' partner-warning';
        return cls;
    },

    /**
     * Whether to show credit column in partner list.
     * @returns {boolean}
     */
    get showCreditColumn() {
        return this.pos.config?.iface_show_customer_balance !== false;
    },

    /**
     * Whether to show type filter buttons.
     * @returns {boolean}
     */
    get showTypeFilters() {
        return true;
    },

    /**
     * Available customer type filter options.
     * @returns {Array}
     */
    get typeFilterOptions() {
        return [
            { value: 'all',         label: 'الكل' },
            { value: 'retail',      label: 'تجزئة' },
            { value: 'electrician', label: 'كهربائي' },
            { value: 'contractor',  label: 'مقاول' },
            { value: 'company',     label: 'شركة' },
        ];
    },

    /**
     * Total count of filtered partners.
     * @returns {number}
     */
    get filteredCount() {
        return this.electricalPartnerList.length;
    },
});