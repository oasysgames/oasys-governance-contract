import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { BytesLike, zeroPadBytes, randomBytes, parseEther } from 'ethers'

const generateSalt = (): BytesLike => zeroPadBytes(randomBytes(32), 32)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

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
    it('Should set the right admins and creators', async function () {
      const { creator, admins, creators, adminRole, createRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await creator.hasRole(adminRole, admin)).to.be.true
      }
      for (const _creator of creators) {
        expect(await creator.hasRole(createRole, _creator)).to.be.true
      }
      expect(await creator.version()).to.equal('0.0.2')
    })
  })

  describe('create', function () {
    it('Should succeed to create simple contract', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()
      const tag = 'Counter'

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      const receipt = await creator
        .connect(creators[0])
        .create(0, salt, deplyTx.data, expectedAddress, tag, ZERO_ADDRESS)
      await expect(receipt)
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, 0, salt, deplyTx.data, expectedAddress)
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

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, salt, deplyTx.data, expectedAddress, '', newAdmin.address, { value: initialDeposit }),
      )
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, initialDeposit, salt, deplyTx.data, expectedAddress)

      expect(await creator.totalCreatedContract()).to.equal(1)
      const metadata = await creator.getMetadataByIndex(0)
      expect(metadata.createdAddress).to.equal(expectedAddress)
      expect(metadata.tag).to.equal('')

      const bank = await ethers.getContractAt('BankPersonal', expectedAddress)
      expect(await bank.balance()).to.equal(initialDeposit)
      expect(await bank.owner()).to.equal(newAdmin.address)
    })

    it('Should revert with unexpected address', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()

      await expect(
        creator.connect(creators[0]).create(0, salt, deplyTx.data, creators[0].address, '', ZERO_ADDRESS),
      ).to.be.revertedWith('PCC: unexpected address')
    })

    it('Should revert if sent amout does not match', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(
        creator.connect(creators[0]).create(initialDeposit, salt, deplyTx.data, expectedAddress, '', ZERO_ADDRESS),
      ).to.be.revertedWith('PCC: incorrect amount sent')
    })

    it('Should revert if duplicated creation', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()
      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await creator
        .connect(creators[0])
        .create(initialDeposit, salt, deplyTx.data, expectedAddress, '', ZERO_ADDRESS, { value: initialDeposit })

      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, salt, deplyTx.data, expectedAddress, '', ZERO_ADDRESS, { value: initialDeposit }),
      ).to.be.revertedWith('Create2: Failed on deploy')
    })

    it('Should revert if failed to transfer owner', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt = generateSalt()
      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(
        creator
          .connect(creators[0])
          .create(initialDeposit, salt, deplyTx.data, expectedAddress, '', newAdmin.address, { value: initialDeposit }),
      ).to.be.revertedWithoutReason()
    })
  })

  describe('bulkCreate', function () {
    it('Should succeed to create multi new Counter contracts', async function () {
      const { creator, creators, newAdmin } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const counterDeplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()
      const counterTag = 'Counter'
      const counterExAddr = await creator.getDeploymentAddress(salt, counterDeplyTx.data)

      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const bankDeplyTx = await Bank.getDeployTransaction()
      const bankTag = 'Bank'
      const bankExAddr = await creator.getDeploymentAddress(salt, bankDeplyTx.data)

      const BankPersonal = await ethers.getContractFactory('BankPersonal')
      const pBankDeplyTx = await BankPersonal.getDeployTransaction()
      const pBankTag = 'BankPersonal'
      const pBankExAddr = await creator.getDeploymentAddress(salt, pBankDeplyTx.data)

      await creator.connect(creators[0]).bulkCreate(
        [
          {
            amount: 0,
            salt,
            bytecode: counterDeplyTx.data,
            expected: counterExAddr,
            tag: counterTag,
            owner: ZERO_ADDRESS,
          },
          {
            amount: initialDeposit,
            salt,
            bytecode: bankDeplyTx.data,
            expected: bankExAddr,
            tag: bankTag,
            owner: ZERO_ADDRESS,
          },
          {
            amount: initialDeposit,
            salt,
            bytecode: pBankDeplyTx.data,
            expected: pBankExAddr,
            tag: pBankTag,
            owner: newAdmin.address,
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

      const pBank = await ethers.getContractAt('BankPersonal', pBankExAddr)
      expect(await pBank.owner()).to.equal(newAdmin.address)
    })

    it('Should revert if sent too much amount', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Bank = await ethers.getContractFactory('Bank')
      const initialDeposit = parseEther('42')
      const deplyTx = await Bank.getDeployTransaction()
      const salt1 = generateSalt()
      const salt2 = generateSalt()

      const expectedAddress1 = await creator.getDeploymentAddress(salt1, deplyTx.data)
      const expectedAddress2 = await creator.getDeploymentAddress(salt2, deplyTx.data)
      await expect(
        creator.connect(creators[0]).bulkCreate(
          [
            {
              amount: initialDeposit,
              salt: salt1,
              bytecode: deplyTx.data,
              expected: expectedAddress1,
              tag: '',
              owner: ZERO_ADDRESS,
            },
            {
              amount: initialDeposit,
              salt: salt2,
              bytecode: deplyTx.data,
              expected: expectedAddress2,
              tag: '',
              owner: ZERO_ADDRESS,
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
      const salt1 = generateSalt()
      const salt2 = generateSalt()

      const expectedAddress1 = await creator.getDeploymentAddress(salt1, deplyTx.data)
      const expectedAddress2 = await creator.getDeploymentAddress(salt2, deplyTx.data)
      await expect(
        creator.connect(creators[0]).bulkCreate(
          [
            {
              amount: initialDeposit,
              salt: salt1,
              bytecode: deplyTx.data,
              expected: expectedAddress1,
              tag: '',
              owner: ZERO_ADDRESS,
            },
            {
              amount: initialDeposit,
              salt: salt2,
              bytecode: deplyTx.data,
              expected: expectedAddress2,
              tag: '',
              owner: ZERO_ADDRESS,
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
})
