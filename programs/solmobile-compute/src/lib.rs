use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("SoMC111111111111111111111111111111111111111");

#[program]
pub mod solmobile_compute {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let network_state = &mut ctx.accounts.network_state;
        network_state.authority = ctx.accounts.authority.key();
        network_state.total_devices = 0;
        network_state.total_tasks_completed = 0;
        network_state.total_tokens_distributed = 0;
        network_state.network_utilization = 0;
        Ok(())
    }

    pub fn register_device(
        ctx: Context<RegisterDevice>,
        device_id: String,
        device_specs: DeviceSpecs,
    ) -> Result<()> {
        let device_account = &mut ctx.accounts.device_account;
        let network_state = &mut ctx.accounts.network_state;
        let clock = Clock::get()?;
        
        device_account.owner = ctx.accounts.owner.key();
        device_account.device_id = device_id;
        device_account.specs = device_specs;
        device_account.is_active = true;
        device_account.reputation_score = 100;
        device_account.total_tasks_completed = 0;
        device_account.total_tokens_earned = 0;
        device_account.last_active = clock.unix_timestamp;
        device_account.tier = DeviceTier::Bronze;
        device_account.staked_amount = 0;
        device_account.stake_timestamp = 0;
        device_account.total_verifications = 0;
        
        network_state.total_devices += 1;
        
        msg!("Device registered successfully: {}", device_account.device_id);
        Ok(())
    }

    pub fn submit_task(
        ctx: Context<SubmitTask>,
        task_id: String,
        task_type: TaskType,
        compute_requirements: ComputeRequirements,
        reward_amount: u64,
    ) -> Result<()> {
        let task_account = &mut ctx.accounts.task_account;
        let clock = Clock::get()?;
        
        task_account.submitter = ctx.accounts.submitter.key();
        task_account.task_id = task_id;
        task_account.task_type = task_type;
        task_account.compute_requirements = compute_requirements;
        task_account.reward_amount = reward_amount;
        task_account.status = TaskStatus::Pending;
        task_account.created_at = clock.unix_timestamp;
        task_account.assigned_at = 0;
        task_account.completed_at = 0;
        task_account.expires_at = 0;
        task_account.result_hash = String::new();
        task_account.verifications = 0;
        task_account.valid_verifications = 0;
        task_account.is_verified = false;
        task_account.assigned_device = None;
        
        msg!("Task submitted: {} with reward: {}", task_account.task_id, reward_amount);
        Ok(())
    }

    pub fn assign_task(
        ctx: Context<AssignTask>,
        task_id: String,
    ) -> Result<()> {
        let task_account = &mut ctx.accounts.task_account;
        let device_account = &mut ctx.accounts.device_account;
        let clock = Clock::get()?;
        
        require!(task_account.status == TaskStatus::Pending, ComputeError::TaskNotPending);
        require!(device_account.is_active, ComputeError::DeviceNotActive);
        
        // Check device capabilities match task requirements
        let cpu_cores_required = task_account.compute_requirements.cpu_cores_required;
        let ram_gb_required = task_account.compute_requirements.ram_gb_required;
        let storage_gb_required = task_account.compute_requirements.storage_gb_required;
        let gpu_required = task_account.compute_requirements.gpu_required;
        let estimated_duration = task_account.compute_requirements.estimated_duration;
        
        let specs = &device_account.specs;
        require!(
            specs.cpu_cores >= cpu_cores_required &&
            specs.ram_gb >= ram_gb_required &&
            specs.storage_gb >= storage_gb_required &&
            (!gpu_required || specs.gpu_available),
            ComputeError::InsufficientCapabilities
        );
        
        // Check device tier for task eligibility
        let min_tier = match task_account.task_type {
            TaskType::DataProcessing => DeviceTier::Bronze,
            TaskType::MLInference => DeviceTier::Silver,
            TaskType::ImageProcessing => DeviceTier::Silver,
            TaskType::VideoTranscoding => DeviceTier::Gold,
            TaskType::GeneralCompute => DeviceTier::Bronze,
        };
        require!(device_account.tier >= min_tier, ComputeError::InsufficientTier);
        
        task_account.assigned_device = Some(device_account.key());
        task_account.status = TaskStatus::Assigned;
        task_account.assigned_at = clock.unix_timestamp;
        task_account.expires_at = clock.unix_timestamp + estimated_duration as i64 * 2; // 2x estimated time
        
        msg!("Task {} assigned to device {}", task_id, device_account.device_id);
        Ok(())
    }

    pub fn complete_task(
        ctx: Context<CompleteTask>,
        task_id: String,
        result_hash: String,
    ) -> Result<()> {
        let task_account = &mut ctx.accounts.task_account;
        let device_account = &mut ctx.accounts.device_account;
        let clock = Clock::get()?;
        
        require!(task_account.status == TaskStatus::Assigned, ComputeError::TaskNotAssigned);
        require!(task_account.assigned_device == Some(device_account.key()), ComputeError::DeviceNotAssigned);
        
        // Check task expiration
        if task_account.expires_at < clock.unix_timestamp {
            task_account.status = TaskStatus::Failed;
            device_account.reputation_score = device_account.reputation_score.saturating_sub(10);
            return Err(ComputeError::TaskExpired.into());
        }
        
        task_account.status = TaskStatus::Completed;
        task_account.result_hash = result_hash;
        task_account.completed_at = clock.unix_timestamp;
        
        // Calculate performance bonus
        let time_taken = clock.unix_timestamp - task_account.assigned_at;
        let estimated_time = task_account.compute_requirements.estimated_duration as i64;
        let performance_multiplier = if time_taken < estimated_time {
            110 // 10% bonus for faster completion
        } else {
            100
        };
        
        let adjusted_reward = task_account.reward_amount
            .checked_mul(performance_multiplier)
            .ok_or(ComputeError::MathOverflow)?
            .checked_div(100)
            .ok_or(ComputeError::MathOverflow)?;
        
        // Transfer tokens to device owner
        let seeds = &[
            b"network_state".as_ref(),
            &[ctx.bumps.network_state]
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.device_token_account.to_account_info(),
            authority: ctx.accounts.network_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, adjusted_reward)?;
        
        device_account.total_tasks_completed += 1;
        device_account.total_tokens_earned += adjusted_reward;
        device_account.last_active = clock.unix_timestamp;
        device_account.reputation_score = device_account.reputation_score.saturating_add(5);
        
        ctx.accounts.network_state.total_tasks_completed += 1;
        ctx.accounts.network_state.total_tokens_distributed += adjusted_reward;
        
        msg!("Task {} completed by device {} with reward {}", task_id, device_account.device_id, adjusted_reward);
        Ok(())
    }

    pub fn update_device_status(
        ctx: Context<UpdateDeviceStatus>,
        is_active: bool,
        current_load: u8,
    ) -> Result<()> {
        let device_account = &mut ctx.accounts.device_account;
        
        device_account.is_active = is_active;
        device_account.current_load = current_load;
        device_account.last_active = Clock::get()?.unix_timestamp;
        
        msg!("Device {} status updated: active={}, load={}", 
            device_account.device_id, is_active, current_load);
        Ok(())
    }
    
    pub fn stake_tokens(
        ctx: Context<StakeTokens>,
        amount: u64,
    ) -> Result<()> {
        let device_account = &mut ctx.accounts.device_account;
        let clock = Clock::get()?;
        
        // Transfer tokens from device owner to stake vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.owner_token_account.to_account_info(),
            to: ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        device_account.staked_amount += amount;
        device_account.stake_timestamp = clock.unix_timestamp;
        
        // Update device tier based on staked amount
        device_account.tier = match device_account.staked_amount {
            0..=1000 => DeviceTier::Bronze,
            1001..=5000 => DeviceTier::Silver,
            5001..=20000 => DeviceTier::Gold,
            _ => DeviceTier::Platinum,
        };
        
        msg!("Device {} staked {} tokens, new tier: {:?}", 
            device_account.device_id, amount, device_account.tier);
        Ok(())
    }
    
    pub fn unstake_tokens(
        ctx: Context<UnstakeTokens>,
        amount: u64,
    ) -> Result<()> {
        let device_account = &mut ctx.accounts.device_account;
        let clock = Clock::get()?;
        
        require!(device_account.staked_amount >= amount, ComputeError::InsufficientStake);
        
        // Check minimum staking period (7 days)
        let staking_duration = clock.unix_timestamp - device_account.stake_timestamp;
        require!(staking_duration >= 7 * 24 * 60 * 60, ComputeError::StakingPeriodNotMet);
        
        // Transfer tokens from stake vault to device owner
        let seeds = &[
            b"network_state".as_ref(),
            &[ctx.bumps.network_state]
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.stake_vault.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
            authority: ctx.accounts.network_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, amount)?;
        
        device_account.staked_amount -= amount;
        
        // Update device tier
        device_account.tier = match device_account.staked_amount {
            0..=1000 => DeviceTier::Bronze,
            1001..=5000 => DeviceTier::Silver,
            5001..=20000 => DeviceTier::Gold,
            _ => DeviceTier::Platinum,
        };
        
        msg!("Device {} unstaked {} tokens, new tier: {:?}", 
            device_account.device_id, amount, device_account.tier);
        Ok(())
    }
    
    pub fn verify_task_result(
        ctx: Context<VerifyTaskResult>,
        task_id: String,
        is_valid: bool,
    ) -> Result<()> {
        let task_account = &mut ctx.accounts.task_account;
        let device_account = &mut ctx.accounts.device_account;
        let verifier_account = &mut ctx.accounts.verifier_account;
        
        require!(task_account.status == TaskStatus::Completed, ComputeError::TaskNotCompleted);
        require!(verifier_account.reputation_score >= 100, ComputeError::InsufficientReputation);
        
        task_account.verifications += 1;
        if is_valid {
            task_account.valid_verifications += 1;
        }
        
        // Byzantine fault tolerance: Need 2/3 valid verifications
        if task_account.verifications >= 3 {
            if task_account.valid_verifications * 3 >= task_account.verifications * 2 {
                task_account.is_verified = true;
                device_account.reputation_score = device_account.reputation_score.saturating_add(2);
            } else {
                task_account.status = TaskStatus::Failed;
                device_account.reputation_score = device_account.reputation_score.saturating_sub(20);
            }
        }
        
        // Reward verifier
        verifier_account.total_verifications += 1;
        verifier_account.reputation_score = verifier_account.reputation_score.saturating_add(1);
        
        msg!("Task {} verification by device {}: valid={}", 
            task_id, verifier_account.device_id, is_valid);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + NetworkState::LEN,
        seeds = [b"network_state"],
        bump
    )]
    pub network_state: Account<'info, NetworkState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(device_id: String)]
pub struct RegisterDevice<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + DeviceAccount::LEN,
        seeds = [b"device", device_id.as_bytes()],
        bump
    )]
    pub device_account: Account<'info, DeviceAccount>,
    #[account(mut)]
    pub network_state: Account<'info, NetworkState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct SubmitTask<'info> {
    #[account(
        init,
        payer = submitter,
        space = 8 + TaskAccount::LEN,
        seeds = [b"task", task_id.as_bytes()],
        bump
    )]
    pub task_account: Account<'info, TaskAccount>,
    #[account(mut)]
    pub submitter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct AssignTask<'info> {
    #[account(
        mut,
        seeds = [b"task", task_id.as_bytes()],
        bump
    )]
    pub task_account: Account<'info, TaskAccount>,
    #[account(mut)]
    pub device_account: Account<'info, DeviceAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct CompleteTask<'info> {
    #[account(
        mut,
        seeds = [b"task", task_id.as_bytes()],
        bump
    )]
    pub task_account: Account<'info, TaskAccount>,
    #[account(mut)]
    pub device_account: Account<'info, DeviceAccount>,
    #[account(
        mut,
        seeds = [b"network_state"],
        bump
    )]
    pub network_state: Account<'info, NetworkState>,
    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub device_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateDeviceStatus<'info> {
    #[account(
        mut,
        has_one = owner
    )]
    pub device_account: Account<'info, DeviceAccount>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(
        mut,
        has_one = owner
    )]
    pub device_account: Account<'info, DeviceAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub stake_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UnstakeTokens<'info> {
    #[account(
        mut,
        has_one = owner
    )]
    pub device_account: Account<'info, DeviceAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"network_state"],
        bump
    )]
    pub network_state: Account<'info, NetworkState>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(task_id: String)]
pub struct VerifyTaskResult<'info> {
    #[account(
        mut,
        seeds = [b"task", task_id.as_bytes()],
        bump
    )]
    pub task_account: Account<'info, TaskAccount>,
    #[account(mut)]
    pub device_account: Account<'info, DeviceAccount>,
    #[account(mut)]
    pub verifier_account: Account<'info, DeviceAccount>,
    pub verifier: Signer<'info>,
}

#[account]
pub struct NetworkState {
    pub authority: Pubkey,
    pub total_devices: u32,
    pub total_tasks_completed: u64,
    pub total_tokens_distributed: u64,
    pub network_utilization: u8,
}

impl NetworkState {
    pub const LEN: usize = 32 + 4 + 8 + 8 + 1;
}

#[account]
pub struct DeviceAccount {
    pub owner: Pubkey,
    pub device_id: String,
    pub specs: DeviceSpecs,
    pub is_active: bool,
    pub reputation_score: u16,
    pub total_tasks_completed: u32,
    pub total_tokens_earned: u64,
    pub current_load: u8,
    pub last_active: i64,
    pub tier: DeviceTier,
    pub staked_amount: u64,
    pub stake_timestamp: i64,
    pub total_verifications: u32,
}

impl DeviceAccount {
    pub const LEN: usize = 32 + 4 + 32 + DeviceSpecs::LEN + 1 + 2 + 4 + 8 + 1 + 8 + 1 + 8 + 8 + 4;
}

#[account]
pub struct TaskAccount {
    pub submitter: Pubkey,
    pub task_id: String,
    pub task_type: TaskType,
    pub compute_requirements: ComputeRequirements,
    pub reward_amount: u64,
    pub status: TaskStatus,
    pub assigned_device: Option<Pubkey>,
    pub result_hash: String,
    pub created_at: i64,
    pub assigned_at: i64,
    pub completed_at: i64,
    pub expires_at: i64,
    pub verifications: u8,
    pub valid_verifications: u8,
    pub is_verified: bool,
}

impl TaskAccount {
    pub const LEN: usize = 32 + 4 + 32 + 1 + ComputeRequirements::LEN + 8 + 1 + 1 + 32 + 4 + 64 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct DeviceSpecs {
    pub cpu_cores: u8,
    pub ram_gb: u8,
    pub storage_gb: u16,
    pub gpu_available: bool,
    pub network_speed: u32,
}

impl DeviceSpecs {
    pub const LEN: usize = 1 + 1 + 2 + 1 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct ComputeRequirements {
    pub cpu_cores_required: u8,
    pub ram_gb_required: u8,
    pub storage_gb_required: u16,
    pub gpu_required: bool,
    pub estimated_duration: u32,
}

impl ComputeRequirements {
    pub const LEN: usize = 1 + 1 + 2 + 1 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum TaskType {
    DataProcessing,
    MLInference,
    ImageProcessing,
    VideoTranscoding,
    GeneralCompute,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum TaskStatus {
    Pending,
    Assigned,
    InProgress,
    Completed,
    Failed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, PartialOrd, Debug)]
pub enum DeviceTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
}

#[error_code]
pub enum ComputeError {
    #[msg("Task is not in pending status")]
    TaskNotPending,
    #[msg("Device is not active")]
    DeviceNotActive,
    #[msg("Task is not assigned")]
    TaskNotAssigned,
    #[msg("Device is not assigned to this task")]
    DeviceNotAssigned,
    #[msg("Insufficient device capabilities")]
    InsufficientCapabilities,
    #[msg("Task expired")]
    TaskExpired,
    #[msg("Insufficient device tier for this task")]
    InsufficientTier,
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Minimum staking period not met")]
    StakingPeriodNotMet,
    #[msg("Task not completed")]
    TaskNotCompleted,
    #[msg("Insufficient reputation for verification")]
    InsufficientReputation,
    #[msg("Math overflow")]
    MathOverflow,
} 