import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MetaInsight {
  spend: string
  impressions: string
  clicks: string
  reach: string
  cpm: string
  cpc: string
  ctr: string
  actions?: { action_type: string; value: string }[]
}

interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  insights?: { data: MetaInsight[] }
}

interface MetaAdset {
  id: string
  name: string
  campaign_id: string
  status: string
  insights?: { data: MetaInsight[] }
}

interface MetaAd {
  id: string
  name: string
  adset_id: string
  status: string
  insights?: { data: MetaInsight[] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const url = new URL(req.url)
    const companyId = url.searchParams.get('company_id')
    const datePreset = url.searchParams.get('date_preset') || 'last_30d'

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'company_id is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[meta-marketing-insights] Fetching insights for company: ${companyId}, date_preset: ${datePreset}`)

    // Fetch Meta credentials from tenant_integrations
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('ad_account_id, meta_access_token, marketing_status')
      .eq('company_id', companyId)
      .single()

    if (integrationError || !integration) {
      console.error('[meta-marketing-insights] Integration not found:', integrationError)
      return new Response(JSON.stringify({ 
        error: 'Meta integration not configured',
        details: 'Configure a integração do Meta Marketing nas configurações'
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (integration.marketing_status !== 'connected') {
      return new Response(JSON.stringify({ 
        error: 'Meta Marketing not connected',
        details: 'Conecte sua conta do Meta Ads nas configurações'
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (!integration.ad_account_id || !integration.meta_access_token) {
      return new Response(JSON.stringify({ 
        error: 'Missing credentials',
        details: 'Ad Account ID ou Access Token não configurados'
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const accessToken = integration.meta_access_token
    const adAccountId = integration.ad_account_id.startsWith('act_') 
      ? integration.ad_account_id 
      : `act_${integration.ad_account_id}`

    const insightFields = 'spend,impressions,clicks,reach,cpm,cpc,ctr,actions'
    const baseUrl = 'https://graph.facebook.com/v21.0'

    // Fetch account info
    console.log('[meta-marketing-insights] Fetching account info...')
    const accountResponse = await fetch(
      `${baseUrl}/${adAccountId}?fields=name,currency,account_status,business_name,business&access_token=${accessToken}`
    )
    const accountData = await accountResponse.json()
    
    if (accountData.error) {
      console.error('[meta-marketing-insights] Account error:', accountData.error)
      // Soft-degrade: return empty payload so callers (BI, dashboards) don't blank-screen.
      // Token invalid/expired (code 190) → user must reconnect Meta in Integrations.
      return new Response(JSON.stringify({
        token_invalid: accountData.error.code === 190,
        error_meta: accountData.error.message,
        code: accountData.error.code,
        account: null,
        campaigns: [],
        adsets: [],
        ads: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch campaigns with insights
    console.log('[meta-marketing-insights] Fetching campaigns...')
    const campaignsResponse = await fetch(
      `${baseUrl}/${adAccountId}/campaigns?fields=id,name,status,objective,insights.date_preset(${datePreset}){${insightFields}}&limit=100&access_token=${accessToken}`
    )
    const campaignsData = await campaignsResponse.json()

    if (campaignsData.error) {
      console.error('[meta-marketing-insights] Campaigns error:', campaignsData.error)
      return new Response(JSON.stringify({ 
        error: 'Meta API Error',
        details: campaignsData.error.message
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch adsets with insights
    console.log('[meta-marketing-insights] Fetching adsets...')
    const adsetsResponse = await fetch(
      `${baseUrl}/${adAccountId}/adsets?fields=id,name,campaign_id,status,insights.date_preset(${datePreset}){${insightFields}}&limit=200&access_token=${accessToken}`
    )
    const adsetsData = await adsetsResponse.json()

    // Fetch ads with insights
    console.log('[meta-marketing-insights] Fetching ads...')
    const adsResponse = await fetch(
      `${baseUrl}/${adAccountId}/ads?fields=id,name,adset_id,status,insights.date_preset(${datePreset}){${insightFields}}&limit=300&access_token=${accessToken}`
    )
    const adsData = await adsResponse.json()

    // Process campaigns
    const campaigns = (campaignsData.data || []).map((campaign: MetaCampaign) => {
      const insight = campaign.insights?.data?.[0]
      const leads = insight?.actions?.find(a => 
        a.action_type === 'lead' || 
        a.action_type === 'leadgen_grouped' ||
        a.action_type === 'onsite_conversion.lead_grouped'
      )?.value || '0'
      const messages = insight?.actions?.find(a => 
        a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
      )?.value || '0'

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        spend: parseFloat(insight?.spend || '0'),
        impressions: parseInt(insight?.impressions || '0'),
        clicks: parseInt(insight?.clicks || '0'),
        reach: parseInt(insight?.reach || '0'),
        cpm: parseFloat(insight?.cpm || '0'),
        cpc: parseFloat(insight?.cpc || '0'),
        ctr: parseFloat(insight?.ctr || '0'),
        leads: parseInt(leads),
        messages: parseInt(messages)
      }
    })

    // Process adsets
    const adsets = (adsetsData.data || []).map((adset: MetaAdset) => {
      const insight = adset.insights?.data?.[0]
      const leads = insight?.actions?.find(a => 
        a.action_type === 'lead' || 
        a.action_type === 'leadgen_grouped'
      )?.value || '0'

      return {
        id: adset.id,
        name: adset.name,
        campaign_id: adset.campaign_id,
        status: adset.status,
        spend: parseFloat(insight?.spend || '0'),
        impressions: parseInt(insight?.impressions || '0'),
        clicks: parseInt(insight?.clicks || '0'),
        ctr: parseFloat(insight?.ctr || '0'),
        leads: parseInt(leads)
      }
    })

    // Process ads
    const ads = (adsData.data || []).map((ad: MetaAd) => {
      const insight = ad.insights?.data?.[0]
      const leads = insight?.actions?.find(a => 
        a.action_type === 'lead' || 
        a.action_type === 'leadgen_grouped'
      )?.value || '0'

      return {
        id: ad.id,
        name: ad.name,
        adset_id: ad.adset_id,
        status: ad.status,
        spend: parseFloat(insight?.spend || '0'),
        impressions: parseInt(insight?.impressions || '0'),
        clicks: parseInt(insight?.clicks || '0'),
        ctr: parseFloat(insight?.ctr || '0'),
        leads: parseInt(leads)
      }
    })

    // Calculate summary
    const totalSpend = campaigns.reduce((sum: number, c: { spend: number }) => sum + c.spend, 0)
    const totalImpressions = campaigns.reduce((sum: number, c: { impressions: number }) => sum + c.impressions, 0)
    const totalClicks = campaigns.reduce((sum: number, c: { clicks: number }) => sum + c.clicks, 0)
    const totalReach = campaigns.reduce((sum: number, c: { reach: number }) => sum + c.reach, 0)
    const totalLeads = campaigns.reduce((sum: number, c: { leads: number }) => sum + c.leads, 0)
    const totalMessages = campaigns.reduce((sum: number, c: { messages: number }) => sum + c.messages, 0)
    const activeCampaigns = campaigns.filter((c: { status: string }) => c.status === 'ACTIVE').length
    const pausedCampaigns = campaigns.filter((c: { status: string }) => c.status === 'PAUSED').length

    // Calculate CPL and CTR
    const totalLeadsForCPL = totalLeads + totalMessages
    const cpl = totalLeadsForCPL > 0 ? totalSpend / totalLeadsForCPL : 0
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    const summary = {
      total_spend: totalSpend,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_reach: totalReach,
      total_leads: totalLeads,
      total_messages: totalMessages,
      active_campaigns: activeCampaigns,
      paused_campaigns: pausedCampaigns,
      cpl,
      ctr
    }

    const response = {
      account_info: {
        id: adAccountId,
        name: accountData.name,
        currency: accountData.currency || 'BRL',
        status: accountData.account_status,
        business_name: accountData.business_name || accountData.business?.name || 'N/A',
        business_id: accountData.business?.id || null
      },
      campaigns,
      adsets,
      ads,
      summary,
      date_preset: datePreset,
      fetched_at: new Date().toISOString()
    }

    console.log(`[meta-marketing-insights] Success! Found ${campaigns.length} campaigns, ${adsets.length} adsets, ${ads.length} ads`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[meta-marketing-insights] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: errorMessage 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
