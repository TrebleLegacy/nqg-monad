// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NQGVoting
 * @notice Simplified governance: one admin approves voters, assigns weights, and schedules polls.
 * @dev Votes relayed by server hot wallet for voter privacy. Relayer submits txs; admin controls policy.
 */
contract NQGVoting {
    struct Voter {
        bool registered;
        bool approved;
        uint256 votePower;
    }

    struct Proposal {
        string question;
        string[] options;
        uint256 startTime;
        uint256 endTime;
        bool exists;
    }

    struct VoteRecord {
        bool hasVoted;
        uint256 optionIndex;
        uint256 weight;
    }

    address public immutable admin;
    address public relayer;

    uint256 public proposalCount;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(uint256 => uint256)) public voteTallies;
    mapping(uint256 => mapping(address => VoteRecord)) public voteRecords;
    mapping(address => Voter) public voters;
    mapping(uint256 => uint256) public totalVoteWeight;

    event ProposalCreated(
        uint256 indexed proposalId,
        string question,
        uint256 startTime,
        uint256 endTime
    );
    event VoterRegistered(address indexed voter);
    event VoterApproved(address indexed voter);
    event VotePowerSet(address indexed voter, uint256 votePower);
    event VoteCast(uint256 indexed proposalId, uint256 optionIndex, uint256 weight);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer || msg.sender == admin, "Not relayer");
        _;
    }

    constructor(address _relayer) {
        admin = msg.sender;
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyAdmin {
        relayer = _relayer;
    }

    // --- Voter lifecycle (relayer registers passkey users; admin admits them) ---

    function registerVoter(address _voter) external onlyRelayer {
        require(!voters[_voter].registered, "Already registered");
        voters[_voter].registered = true;
        emit VoterRegistered(_voter);
    }

    function approveVoter(address _voter) external onlyAdmin {
        require(voters[_voter].registered, "Not registered");
        require(!voters[_voter].approved, "Already approved");
        voters[_voter].approved = true;
        emit VoterApproved(_voter);
    }

    function setVotePower(address _voter, uint256 _power) external onlyAdmin {
        require(voters[_voter].registered, "Not registered");
        voters[_voter].votePower = _power;
        emit VotePowerSet(_voter, _power);
    }

    function getVotePower(address _voter) public view returns (uint256) {
        Voter storage v = voters[_voter];
        if (!v.registered || !v.approved) return 0;
        return v.votePower;
    }

    // --- Proposals (admin sets question, options, and voting window) ---

    function createProposal(
        string memory _question,
        string[] memory _options,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyAdmin returns (uint256) {
        require(_options.length >= 2 && _options.length <= 10, "2-10 options");
        require(_startTime < _endTime, "Invalid window");

        uint256 proposalId = proposalCount++;

        Proposal storage p = proposals[proposalId];
        p.question = _question;
        p.options = _options;
        p.startTime = _startTime;
        p.endTime = _endTime;
        p.exists = true;

        emit ProposalCreated(proposalId, _question, _startTime, _endTime);
        return proposalId;
    }

    function setProposalWindow(
        uint256 _proposalId,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyAdmin {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(_startTime < _endTime, "Invalid window");
        p.startTime = _startTime;
        p.endTime = _endTime;
    }

    // --- Voting ---

    function vote(uint256 _proposalId, address _voter, uint256 _optionIndex) external onlyRelayer {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");
        require(block.timestamp >= p.startTime, "Voting not open");
        require(block.timestamp < p.endTime, "Voting closed");
        require(!voteRecords[_proposalId][_voter].hasVoted, "Already voted");
        require(voters[_voter].registered && voters[_voter].approved, "Not approved");
        require(_optionIndex < p.options.length, "Invalid option");

        uint256 weight = getVotePower(_voter);
        require(weight > 0, "Zero vote power");

        voteRecords[_proposalId][_voter] = VoteRecord({
            hasVoted: true,
            optionIndex: _optionIndex,
            weight: weight
        });

        voteTallies[_proposalId][_optionIndex] += weight;
        totalVoteWeight[_proposalId] += weight;

        emit VoteCast(_proposalId, _optionIndex, weight);
    }

    function getResults(uint256 _proposalId) external view returns (uint256[] memory) {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Proposal not found");

        uint256[] memory results = new uint256[](p.options.length);
        for (uint256 i = 0; i < p.options.length; i++) {
            results[i] = voteTallies[_proposalId][i];
        }
        return results;
    }

    function getProposalOptions(uint256 _proposalId) external view returns (string[] memory) {
        require(proposals[_proposalId].exists, "Not found");
        return proposals[_proposalId].options;
    }

    function getProposalInfo(uint256 _proposalId)
        external
        view
        returns (
            string memory question,
            uint256 startTime,
            uint256 endTime,
            uint256 optionCount,
            uint256 totalWeight,
            bool votingOpen
        )
    {
        Proposal storage p = proposals[_proposalId];
        require(p.exists, "Not found");
        uint256 t = block.timestamp;
        votingOpen = t >= p.startTime && t < p.endTime;
        return (
            p.question,
            p.startTime,
            p.endTime,
            p.options.length,
            totalVoteWeight[_proposalId],
            votingOpen
        );
    }

    function getVoterInfo(address _voter)
        external
        view
        returns (
            bool registered,
            bool approved,
            uint256 votePower
        )
    {
        Voter storage v = voters[_voter];
        return (v.registered, v.approved, getVotePower(_voter));
    }
}
