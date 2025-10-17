use crate::state;

use anchor_lang::prelude::*;

pub enum Achievements {
    FirstHypeVote,
    NumAchievements,
}

fn check_hype_votes(total_votes: usize, threshold: u16) -> u8 {
    if total_votes >= threshold as usize {
        return 2;
    }
    return 1;
}

pub fn check_user_achievements(mut user_data: state::UserData) -> ProgramResult {
    let n_achievements = Achievements::NumAchievements as usize;

    if user_data.stats.achievements_earnt.len() < n_achievements {
        for _i in user_data.stats.achievements_earnt.len()..n_achievements {
            user_data.stats.achievements_earnt.push(1);
        }
    }

    // check if any achievements have been set previously, but not claimed (ie they are state 2)
    // if so set to state 3 so the front end doesn't bother showing them again
    for n in 0..n_achievements {
        if user_data.stats.achievements_earnt[n as usize] == 2 {
            user_data.stats.achievements_earnt[n as usize] = 3;
        }
    }

    if user_data.stats.achievements_earnt[Achievements::FirstHypeVote as usize] == 1 {
        user_data.stats.achievements_earnt[Achievements::FirstHypeVote as usize] = check_hype_votes(user_data.votes.len(), 1);
    }

    return Ok(());
}
