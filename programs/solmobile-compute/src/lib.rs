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
        
        device_account.owner = ctx.accounts.owner.key();
        device_account.device_id = device_id;
        device_account.specs = device_specs;
        device_account.is_active = true;
        device_account.reputation_score = 100;
        device_account.total_tasks_completed = 0;
        device_account.total_tokens_earned = 0;
        device_account.last_active = Clock::get()?.unix_timestamp;
        
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
        
        task_account.submitter = ctx.accounts.submitter.key();
        task_account.task_id = task_id;
        task_account.task_type = task_type;
        task_account.compute_requirements = compute_requirements;
        task_account.reward_amount = reward_amount;
        task_account.status = TaskStatus::Pending;
        task_account.created_at = Clock::get()?.unix_timestamp;
        
        msg!("Task submitted: {} with reward: {}", task_account.task_id, reward_amount);
        Ok(())
    }

    pub fn assign_task(
        ctx: Context<AssignTask>,
        task_id: String,
    ) -> Result<()> {
        let task_account = &mut ctx.accounts.task_account;
        let device_account = &mut ctx.accounts.device_account;
        
        require!(task_account.status == TaskStatus::Pending, ComputeError::TaskNotPending);
        require!(device_account.is_active, ComputeError::DeviceNotActive);
        
        task_account.assigned_device = Some(device_account.key());
        task_account.status = TaskStatus::Assigned;
        task_account.assigned_at = Clock::get()?.unix_timestamp;
        
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
        let network_state = &mut ctx.accounts.network_state;
        
        require!(task_account.status == TaskStatus::Assigned, ComputeError::TaskNotAssigned);
        require!(task_account.assigned_device == Some(device_account.key()), ComputeError::DeviceNotAssigned);
        
        task_account.status = TaskStatus::Completed;
        task_account.result_hash = result_hash;
        task_account.completed_at = Clock::get()?.unix_timestamp;
        
        device_account.total_tasks_completed += 1;
        device_account.total_tokens_earned += task_account.reward_amount;
        device_account.last_active = Clock::get()?.unix_timestamp;
        
        network_state.total_tasks_completed += 1;
        network_state.total_tokens_distributed += task_account.reward_amount;
        
        msg!("Task {} completed by device {}", task_id, device_account.device_id);
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
    #[account(mut)]
    pub network_state: Account<'info, NetworkState>,
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
}

impl DeviceAccount {
    pub const LEN: usize = 32 + 4 + 32 + DeviceSpecs::LEN + 1 + 2 + 4 + 8 + 1 + 8;
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
}

impl TaskAccount {
    pub const LEN: usize = 32 + 4 + 32 + 1 + ComputeRequirements::LEN + 8 + 1 + 1 + 32 + 4 + 64 + 8 + 8 + 8;
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
} 