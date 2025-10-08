use borsh::{BorshDeserialize, BorshSerialize};

/// mints a new random hybrid every time
// just burns it when it is returned
#[derive(Copy, Clone, BorshSerialize, BorshDeserialize, Debug, Eq, PartialEq)]
pub struct Achievements {
    pub num_easy_missions: u32,
    pub num_medium_missions: u32,
    pub num_hard_missions: u32,
}

#[repr(C)]
#[derive(Hash, Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum PluginType {
    Achievements,
}

/// Definition of the collection variants
#[repr(C)]
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Eq, PartialEq)]
pub enum Plugin {
    Achievements(Achievements),
}

impl From<&Plugin> for PluginType {
    fn from(plugin: &Plugin) -> Self {
        match plugin {
            Plugin::Achievements(_) => PluginType::Achievements,
        }
    }
}

pub fn find_plugin<'a>(plugins: &'a [Plugin], plugin_type: PluginType) -> Option<&'a Plugin> {
    plugins
        .iter()
        .find(|plugin| PluginType::from(*plugin) == plugin_type)
}
