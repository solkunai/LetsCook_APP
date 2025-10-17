use std::collections::HashMap;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct AsymmetricSwapPrice {
    pub return_swap_price: u64,
}

#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct MintProbability {
    pub mint_prob: u16,
}

#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct WhiteListToken {
    pub key: Pubkey,
    pub quantity: u64,
    pub phase_end: u64,
}

#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct Listing {
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct NewListing {
    pub collection: Pubkey,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[derive(Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct Marketplace {
    pub listings: Vec<Listing>,
}

#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum CollectionPlugin {
    /// Different swap price when returning an nft
    AsymmetricSwapPrice(AsymmetricSwapPrice),
    MintProbability(MintProbability),
    WhiteListToken(WhiteListToken),
    MintOnly(),
    Marketplace(Marketplace),
}

#[repr(C)]
#[derive(Hash, Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum CollectionPluginType {
    /// Different swap price when returning an nft
    AsymmetricSwapPrice,
    MintProbability,
    WhiteListToken,
    MintOnly,
    Marketplace,
}

impl From<&CollectionPlugin> for CollectionPluginType {
    fn from(plugin: &CollectionPlugin) -> Self {
        match plugin {
            CollectionPlugin::AsymmetricSwapPrice(_) => CollectionPluginType::AsymmetricSwapPrice,
            CollectionPlugin::MintProbability(_) => CollectionPluginType::MintProbability,
            CollectionPlugin::WhiteListToken(_) => CollectionPluginType::WhiteListToken,
            CollectionPlugin::MintOnly() => CollectionPluginType::MintOnly,
            CollectionPlugin::Marketplace(_) => CollectionPluginType::Marketplace,
        }
    }
}

pub fn get_collection_plugin_map(plugin_vec: Vec<CollectionPlugin>) -> HashMap<CollectionPluginType, CollectionPlugin> {
    let mut map: HashMap<CollectionPluginType, CollectionPlugin> = HashMap::new();

    for plugin in plugin_vec {
        map.insert(CollectionPluginType::from(&plugin), plugin);
    }

    return map;
}

pub fn find_plugin<'a>(plugins: &'a [CollectionPlugin], plugin_type: CollectionPluginType) -> Option<&'a CollectionPlugin> {
    plugins.iter().find(|plugin| CollectionPluginType::from(*plugin) == plugin_type)
}
