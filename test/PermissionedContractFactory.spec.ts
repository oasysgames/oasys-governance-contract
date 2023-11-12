import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { BytesLike, zeroPadBytes, randomBytes, parseEther } from 'ethers'

const generateSalt = (): BytesLike => zeroPadBytes(randomBytes(32), 32)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_BYTE32 = '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('PermissionedContractFactory', function () {
  async function deployContractsFixture() {
    // admins and creators
    const [admin, creator1, creator2, newAdmin, newCreator] = await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [admin]
    const creators: HardhatEthersSigner[] = [creator1, creator2]
    // deploy
    const Creator = await ethers.getContractFactory('PermissionedContractFactory')
    const creator = await Creator.deploy([admin.address], [creator1.address, creator2.address], ZERO_ADDRESS)
    const creatorV2 = await Creator.deploy([admin.address], [creator1.address, creator2.address], creator.target)
    // roles
    const adminRole = await creator.DEFAULT_ADMIN_ROLE()
    const createRole = await creator.CONTRACT_CREATOR_ROLE()
    return { creator, creatorV2, admins, creators, newAdmin, newCreator, adminRole, createRole }
  }

  describe('Deployment', function () {
    it('Should set the right admins and creators and prev and version', async function () {
      const { creator, creatorV2, admins, creators, adminRole, createRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await creator.hasRole(adminRole, admin)).to.be.true
      }
      for (const _creator of creators) {
        expect(await creator.hasRole(createRole, _creator)).to.be.true
      }
      expect(await creator.prevRegistory()).to.equal(ZERO_ADDRESS)
      expect(await creatorV2.prevRegistory()).to.equal(creator.target)
      expect(await creator.version()).to.equal('0.0.2')
    })
  })

  describe('create', function () {
    it('Should succeed to create simple contract', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const tag = 'Counter'

      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      const receipt = await creator.connect(creators[0]).create(0, ZERO_BYTE32, deplyTx.data, expectedAddress, tag, [])
      await expect(receipt)
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, 0, deplyTx.data.substring(0, 66), deplyTx.data, expectedAddress)
      await expect(receipt).to.emit(creator, 'Registerd').withArgs(creators[0].address, expectedAddress, tag)

      const metadata = await creator.getMetadata(expectedAddress)
      expect(metadata.createdAddress).to.equal(expectedAddress)
      expect(metadata.creator).to.equal(creators[0].address)
      expect(metadata.tag).to.equal(tag)

      const counter = await ethers.getContractAt('Counter', expectedAddress)
      expect(await counter.get()).to.equal(initialCount)
    })

    it('Should succeed to fund inital amount/transfer admin ship', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('BankPersonal')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, salt)
      const bank = await ethers.getContractAt('BankPersonal', expectedAddress)
      const name = 'personal bank'
      const call1 = await bank.getFunction('initalize').populateTransaction(name)
      const call2 = await bank.getFunction('transferOwnership').populateTransaction(newAdmin.address)

      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, salt, deplyTx.data, expectedAddress, '', [call1.data, call2.data], {
            value: initialDeposit,
          }),
      )
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, initialDeposit, salt, deplyTx.data, expectedAddress)

      expect(await creator.totalCreatedContract()).to.equal(1)
      const metadata = await creator.getMetadataByIndex(0)
      expect(metadata.createdAddress).to.equal(expectedAddress)
      expect(metadata.tag).to.equal('')

      expect(await bank.balance()).to.equal(initialDeposit)
      expect(await bank.owner()).to.equal(newAdmin.address)
      expect(await bank.name()).to.equal(name)
    })

    it('Should revert with unexpected address', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)

      await expect(
        creator.connect(creators[0]).create(0, ZERO_BYTE32, deplyTx.data, creators[0].address, '', []),
      ).to.be.revertedWith('PCC: unexpected address')
    })

    it('Should revert if sent amout does not match', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()

      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      await expect(
        creator.connect(creators[0]).create(initialDeposit, ZERO_BYTE32, deplyTx.data, expectedAddress, '', []),
      ).to.be.revertedWith('PCC: incorrect amount sent')
    })

    it('Should revert if duplicated creation', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      await creator
        .connect(creators[0])
        .create(initialDeposit, ZERO_BYTE32, deplyTx.data, expectedAddress, '', [], { value: initialDeposit })

      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, ZERO_BYTE32, deplyTx.data, expectedAddress, '', [], { value: initialDeposit }),
      ).to.be.revertedWith('Create2: Failed on deploy')
    })

    it('Should revert if afater call failed: revert with string reason', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('BankPersonal')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      const bank = await ethers.getContractAt('BankPersonal', expectedAddress)
      const name = 'personal bank'
      const call1 = await bank.getFunction('initalize').populateTransaction(name)
      const call2 = await bank.getFunction('transferOwnership').populateTransaction(newAdmin.address)

      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, ZERO_BYTE32, deplyTx.data, expectedAddress, '', [call2.data, call1.data], {
            value: initialDeposit,
          }),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should revert if afater call failed: revert with custom error', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('BankPersonal')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const expectedAddress = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      const bank = await ethers.getContractAt('BankPersonal', expectedAddress)
      const name = 'personal bank'
      const call1 = await bank.getFunction('initalize').populateTransaction(name)

      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, ZERO_BYTE32, deplyTx.data, expectedAddress, '', [call1.data, call1.data], {
            value: initialDeposit,
          }),
      ).to.be.revertedWithCustomError(bank, 'AlreadyInitalized')
    })
  })

  describe('bulkCreate', function () {
    it('Should succeed to create multi new Counter contracts', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const counterDeplyTx = await Counter.getDeployTransaction(initialCount)
      const counterTag = 'Counter'
      const counterExAddr = await creator.getDeploymentAddress(counterDeplyTx.data, ZERO_BYTE32)

      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const bankDeplyTx = await Bank.getDeployTransaction()
      const bankTag = 'Bank'
      const bankExAddr = await creator.getDeploymentAddress(bankDeplyTx.data, ZERO_BYTE32)

      const BankPersonal = await ethers.getContractFactory('BankPersonal')
      const pBankDeplyTx = await BankPersonal.getDeployTransaction()
      const pBankTag = 'BankPersonal'
      const pBankExAddr = await creator.getDeploymentAddress(pBankDeplyTx.data, ZERO_BYTE32)
      const pBank = await ethers.getContractAt('BankPersonal', pBankExAddr)
      const call = await pBank.getFunction('transferOwnership').populateTransaction(newAdmin.address)

      await creator.connect(creators[0]).bulkCreate(
        [
          {
            amount: 0,
            salt: ZERO_BYTE32,
            bytecode: counterDeplyTx.data,
            expected: counterExAddr,
            tag: counterTag,
            afterCalldatas: [],
          },
          {
            amount: initialDeposit,
            salt: ZERO_BYTE32,
            bytecode: bankDeplyTx.data,
            expected: bankExAddr,
            tag: bankTag,
            afterCalldatas: [],
          },
          {
            amount: initialDeposit,
            salt: ZERO_BYTE32,
            bytecode: pBankDeplyTx.data,
            expected: pBankExAddr,
            tag: pBankTag,
            afterCalldatas: [call.data],
          },
        ],
        { value: initialDeposit * BigInt(2) },
      )

      expect(await creator.totalCreatedContract()).to.equal(3)

      let metadata = await creator.getMetadata(counterExAddr)
      expect(metadata.createdAddress).to.equal(counterExAddr)
      expect(metadata.creator).to.equal(creators[0].address)
      expect(metadata.tag).to.equal(counterTag)

      metadata = await creator.getMetadataByIndex(1)
      expect(metadata.createdAddress).to.equal(bankExAddr)
      expect(metadata.tag).to.equal(bankTag)

      const counter = await ethers.getContractAt('Counter', counterExAddr)
      expect(await counter.get()).to.equal(initialCount)

      const bank = await ethers.getContractAt('Bank', bankExAddr)
      expect(await bank.balance()).to.equal(initialDeposit)

      expect(await pBank.owner()).to.equal(newAdmin.address)
    })

    it('Should revert if sent too much amount', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx1 = await Bank.getDeployTransaction()
      const expectedAddress1 = await creator.getDeploymentAddress(deplyTx1.data, ZERO_BYTE32)

      const pBank = await ethers.getContractFactory('BankPersonal')
      const deplyTx2 = await pBank.getDeployTransaction()
      const expectedAddress2 = await creator.getDeploymentAddress(deplyTx2.data, ZERO_BYTE32)
      await expect(
        creator.connect(creators[0]).bulkCreate(
          [
            {
              amount: initialDeposit,
              salt: ZERO_BYTE32,
              bytecode: deplyTx1.data,
              expected: expectedAddress1,
              tag: '',
              afterCalldatas: [],
            },
            {
              amount: initialDeposit,
              salt: ZERO_BYTE32,
              bytecode: deplyTx2.data,
              expected: expectedAddress2,
              tag: '',
              afterCalldatas: [],
            },
          ],
          { value: initialDeposit * BigInt(3) },
        ),
      ).to.be.revertedWith('PCC: too much amount sent')
    })

    it('Should revert if insufficent amout sent', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()

      const expectedAddress1 = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      const expectedAddress2 = await creator.getDeploymentAddress(deplyTx.data, ZERO_BYTE32)
      await expect(
        creator.connect(creators[0]).bulkCreate(
          [
            {
              amount: initialDeposit,
              salt: ZERO_BYTE32,
              bytecode: deplyTx.data,
              expected: expectedAddress1,
              tag: '',
              afterCalldatas: [],
            },
            {
              amount: initialDeposit,
              salt: ZERO_BYTE32,
              bytecode: deplyTx.data,
              expected: expectedAddress2,
              tag: '',
              afterCalldatas: [],
            },
          ],
          { value: initialDeposit + parseEther('41') },
        ),
      ).to.be.revertedWith('PCC: insufficient amount sent')
    })
  })

  describe('grantRole', function () {
    it('Should succeed to grant admin role', async function () {
      const { creator, admins, newAdmin, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).grantRole(adminRole, newAdmin.address))
        .to.emit(creator, 'RoleGranted')
        .withArgs(adminRole, newAdmin.address, admins[0].address)
      expect(await creator.hasRole(adminRole, newAdmin.address)).to.true
    })

    it('Should succeed to grant create role', async function () {
      const { creator, admins, newCreator, createRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).grantRole(createRole, newCreator.address))
        .to.emit(creator, 'RoleGranted')
        .withArgs(createRole, newCreator.address, admins[0].address)
      expect(await creator.hasRole(createRole, newCreator.address)).to.true
    })

    it('Should revert by ungranted caller', async function () {
      const { creator, newCreator, creators, createRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(creators[1]).grantRole(createRole, newCreator.address)).to.be.revertedWith(
        `AccessControl: account ${creators[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('revokeRole', function () {
    it('Should succeed to revoke admin role', async function () {
      const { creator, admins, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).revokeRole(adminRole, admins[0].address))
        .to.emit(creator, 'RoleRevoked')
        .withArgs(adminRole, admins[0].address, admins[0].address)
      expect(await creator.hasRole(adminRole, admins[0].address)).to.false
    })

    it('Should succeed to revoke creator role', async function () {
      const { creator, creators, admins, createRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(admins[0]).revokeRole(createRole, creators[1].address))
        .to.emit(creator, 'RoleRevoked')
        .withArgs(createRole, creators[1].address, admins[0].address)
      expect(await creator.hasRole(createRole, creators[1].address)).to.false
    })

    it('Should revert by ungranted caller', async function () {
      const { creator, creators, createRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(creator.connect(creators[1]).revokeRole(createRole, creators[0].address)).to.be.revertedWith(
        `AccessControl: account ${creators[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('upgrade factory contract', function () {
    it('Should the new verson continue hold previous version context', async function () {
      const { creator, creatorV2, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const counterDeplyTx = await Counter.getDeployTransaction(initialCount)
      const counterTag = 'Counter'
      const counterExAddr = await creator.getDeploymentAddress(counterDeplyTx.data, ZERO_BYTE32)

      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const bankDeplyTx = await Bank.getDeployTransaction()
      const bankTag = 'Bank'
      const bankExAddr = await creator.getDeploymentAddress(bankDeplyTx.data, ZERO_BYTE32)

      const BankPersonal = await ethers.getContractFactory('BankPersonal')
      const pBankDeplyTx = await BankPersonal.getDeployTransaction()
      const pBankTag = 'BankPersonal'
      const pBankExAddr = await creatorV2.getDeploymentAddress(pBankDeplyTx.data, ZERO_BYTE32)

      await creator.connect(creators[0]).bulkCreate(
        [
          {
            amount: 0,
            salt: ZERO_BYTE32,
            bytecode: counterDeplyTx.data,
            expected: counterExAddr,
            tag: counterTag,
            afterCalldatas: [],
          },
          {
            amount: initialDeposit,
            salt: ZERO_BYTE32,
            bytecode: bankDeplyTx.data,
            expected: bankExAddr,
            tag: bankTag,
            afterCalldatas: [],
          },
        ],
        { value: initialDeposit },
      )

      await creatorV2
        .connect(creators[0])
        .create(initialDeposit, ZERO_BYTE32, pBankDeplyTx.data, pBankExAddr, pBankTag, [], {
          value: initialDeposit,
        })

      expect(await creatorV2.totalCreatedContract()).to.equal(3)
      expect(await creatorV2.totalCreatedContracFromThis()).to.equal(1)

      let metadata = await creatorV2.getMetadata(counterExAddr)
      expect(metadata.createdAddress).to.equal(counterExAddr)

      metadata = await creatorV2.getMetadata(pBankExAddr)
      expect(metadata.createdAddress).to.equal(pBankExAddr)

      metadata = await creatorV2.getMetadataByIndex(0)
      expect(metadata.createdAddress).to.equal(pBankExAddr)
    })
  })
})
