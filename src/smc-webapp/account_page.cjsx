misc = require('smc-util/misc')

# Import redux_account, so the account store is initialized.
require('./redux_account')

{React, ReactDOM, rclass, rtypes, redux, Redux} = require('./smc-react')
{Tab, Tabs, Grid} = require('react-bootstrap')
{LandingPage} = require('./landing_page')
{AccountSettingsTop} = require('./r_account')
{BillingPageRedux} = require('./billing')
{UpgradesPage} = require('./r_upgrades')
{SupportPage}  = require('./support')
{Icon} = require('./r_misc')
{set_url} = require('./history')

browser = require('./browser')

AccountPage = rclass
    displayName : 'AccountPage'

    reduxProps :
        projects :
            project_map             : rtypes.immutable
        account :
            active_page             : rtypes.string
            strategies              : rtypes.array
            sign_up_error           : rtypes.object
            sign_in_error           : rtypes.string
            signing_in              : rtypes.bool
            signing_up              : rtypes.bool
            forgot_password_error   : rtypes.string
            forgot_password_success : rtypes.string # is this needed?
            show_forgot_password    : rtypes.bool
            token                   : rtypes.bool
            reset_key               : rtypes.string
            reset_password_error    : rtypes.string
            remember_me             : rtypes.bool
            first_name              : rtypes.string
            last_name               : rtypes.string
            email_address           : rtypes.string
            passports               : rtypes.object
            show_sign_out           : rtypes.bool
            sign_out_error          : rtypes.string
            everywhere              : rtypes.bool
            terminal                : rtypes.object
            evaluate_key            : rtypes.string
            autosave                : rtypes.number
            font_size               : rtypes.number
            editor_settings         : rtypes.object
            other_settings          : rtypes.object
            profile                 : rtypes.object
            groups                  : rtypes.array
            stripe_customer         : rtypes.object

    propTypes :
        actions : rtypes.object.isRequired
        redux   : rtypes.object.isRequired

    handle_select : (key) ->
        switch key
            when 'billing'
                @props.redux.getActions('billing')?.update_customer()
            when 'support'
                @props.redux.getActions('support')?.load_support_tickets()
        @props.redux.getActions('account').set_active_tab(key)
        @props.redux.getActions('account').push_state("/#{key}")

    render_upgrades : ->
        <UpgradesPage
            redux           = {@props.redux}
            stripe_customer = {@props.stripe_customer}
            project_map     = {@props.project_map} />

    render_support : ->
        <Redux redux={redux}>
            <SupportPage />
        </Redux>

    render_account_settings : ->
        <AccountSettingsTop
            redux           = {@props.redux}
            first_name      = {@props.first_name}
            last_name       = {@props.last_name}
            email_address   = {@props.email_address}
            passports       = {@props.passports}
            show_sign_out   = {@props.show_sign_out}
            sign_out_error  = {@props.sign_out_error}
            everywhere      = {@props.everywhere}
            terminal        = {@props.terminal}
            evaluate_key    = {@props.evaluate_key}
            autosave        = {@props.autosave}
            font_size       = {@props.font_size}
            editor_settings = {@props.editor_settings}
            other_settings  = {@props.other_settings}
            profile         = {@props.profile}
            groups          = {@props.groups} />

    render_landing_page : ->
        <LandingPage
            redux                   = {redux}
            actions                 = {@props.actions}
            strategies              = {@props.strategies}
            sign_up_error           = {@props.sign_up_error}
            sign_in_error           = {@props.sign_in_error}
            signing_in              = {@props.signing_in}
            signing_up              = {@props.signing_up}
            forgot_password_error   = {@props.forgot_password_error}
            forgot_password_success = {@props.forgot_password_success}
            show_forgot_password    = {@props.show_forgot_password}
            token                   = {@props.token}
            reset_key               = {@props.reset_key}
            reset_password_error    = {@props.reset_password_error}
            remember_me             = {@props.remember_me}
            has_account             = {localStorage.length > 0} />

    render : ->
        logged_in = @props.redux.getStore('account').is_logged_in()
        <Grid fluid className='constrained'>
            {@render_landing_page() if not logged_in}
            {<Tabs activeKey={@props.active_page} onSelect={@handle_select} animation={false} style={paddingTop: "1em"} id="account-page-tabs">
                <Tab eventKey="account" title={<span><Icon name='wrench'/> Account Settings</span>}>
                    {@render_account_settings()  if not @props.active_page? or @props.active_page == 'account'}
                </Tab>
                <Tab eventKey="billing" title={<span><Icon name='money'/> Billing</span>}>
                    {<BillingPageRedux /> if @props.active_page == 'billing'}
                </Tab>
                <Tab eventKey="upgrades" title={<span><Icon name='arrow-circle-up'/> Upgrades</span>}>
                    {@render_upgrades() if @props.active_page == 'upgrades'}
                </Tab>
                <Tab eventKey="support" title={<span><Icon name='medkit'/> Support</span>}>
                    {@render_support() if @props.active_page == 'support'}
                </Tab>
            </Tabs> if logged_in}
        </Grid>

exports.AccountPageRedux = AccountPageRedux = rclass
    render : ->
        actions = redux.getActions('account')
        <Redux redux={redux}>
            <AccountPage actions={actions} redux={redux}/>
        </Redux>