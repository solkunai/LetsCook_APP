use std::collections::HashMap;

use borsh::{BorshDeserialize, BorshSerialize};

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct TradeToEarn {
    pub total_tokens: u64,
    pub first_reward_date: u32,
    pub last_reward_date: u32,
}

// when liquidity is low the number of tokens a user gets is reduced to help build up liquidity
// they get only MIN(1, scalar * original_output / threshold)
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct LiquidityScaling {
    pub scalar: u16,
    pub threshold: u64,
    pub active: u8,
}

#[repr(C)]
#[derive(Hash, Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum AMMPluginType {
    /// Standard raffle launch
    TradeToEarn,
    LiquidityScaling,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum AMMPlugin {
    /// User gets a random nft from a fixed supply
    TradeToEarn(TradeToEarn),
    LiquidityScaling(LiquidityScaling),
}

impl From<&AMMPlugin> for AMMPluginType {
    fn from(plugin: &AMMPlugin) -> Self {
        match plugin {
            AMMPlugin::TradeToEarn(_) => AMMPluginType::TradeToEarn,
            AMMPlugin::LiquidityScaling(_) => AMMPluginType::LiquidityScaling,
        }
    }
}

pub fn get_amm_plugin_map(plugin_vec: &Vec<AMMPlugin>) -> HashMap<AMMPluginType, AMMPlugin> {
    let mut map: HashMap<AMMPluginType, AMMPlugin> = HashMap::new();

    for plugin in plugin_vec.iter().cloned() {
        map.insert(AMMPluginType::from(&plugin), plugin);
    }

    return map;
}
