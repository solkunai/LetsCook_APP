use std::collections::HashMap;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct WhiteListToken {
    pub key: Pubkey,
    pub quantity: u64,
    pub phase_end: u64,
}

#[repr(C)]
#[derive(Hash, Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchPluginType {
    /// Standard raffle launch
    WhiteListToken,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchPlugin {
    /// User gets a random nft from a fixed supply
    WhiteListToken(WhiteListToken),
}

impl From<&LaunchPlugin> for LaunchPluginType {
    fn from(collection_meta: &LaunchPlugin) -> Self {
        match collection_meta {
            LaunchPlugin::WhiteListToken(_) => LaunchPluginType::WhiteListToken,
        }
    }
}

pub fn get_launch_plugin_map(plugin_vec: Vec<LaunchPlugin>) -> HashMap<LaunchPluginType, LaunchPlugin> {
    let mut map: HashMap<LaunchPluginType, LaunchPlugin> = HashMap::new();

    for plugin in plugin_vec {
        map.insert(LaunchPluginType::from(&plugin), plugin);
    }

    return map;
}

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct Raffle {}

// basic first come first serve launch, closes when the last ticket is sold
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct FCFS {}

// runs until the end, all SOL raised goes into the AMM, refunds only if it fails
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub struct IDO {
    pub token_fraction_distributed: f64,
    pub tokens_distributed: u64,
}

#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum LaunchMetaType {
    /// Standard raffle launch
    Raffle,
    FCFS,
    IDO,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, PartialEq)]
pub enum LaunchMeta {
    /// User gets a random nft from a fixed supply
    Raffle(Raffle),
    FCFS(FCFS),
    IDO(IDO),
}

impl From<&LaunchMeta> for LaunchMetaType {
    fn from(collection_meta: &LaunchMeta) -> Self {
        match collection_meta {
            LaunchMeta::Raffle(_) => LaunchMetaType::Raffle,
            LaunchMeta::FCFS(_) => LaunchMetaType::FCFS,
            LaunchMeta::IDO(_) => LaunchMetaType::IDO,
        }
    }
}
