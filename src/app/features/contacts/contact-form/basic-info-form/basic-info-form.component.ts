import { Component, OnInit, Input } from '@angular/core';
import { ValidationErrors, FormGroup, ValidatorFn, AsyncValidatorFn, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { sources } from '../../constants/source';
import { contactStatuses } from '../../constants/contact-status';
import { linesOfBusiness } from '../../constants/line-of-business';
import { DropdownOption } from '../../../ui/model/dropdown-option'
import { Contact } from '../../models/contact';
import { Observable, of } from 'rxjs';
import { map, delay, switchMap, startWith } from 'rxjs/operators';
import { ContactService } from '../../../service/contact.service';
import { AccountService } from '../../../service/account.service';
import { Account } from '../../models/account';

@Component({
  selector: 'contact-basic-info-form',
  templateUrl: './basic-info-form.component.html',
  styleUrls: ['./basic-info-form.component.css']
})
export class BasicInfoFormComponent implements OnInit {

  basicInfoFormGroup: FormGroup;
  originalFormState: Contact;

  availableSources: DropdownOption[] = sources;
  availableContactStatuses: DropdownOption[] = contactStatuses;
  availableLinesOfBusiness: DropdownOption[] = linesOfBusiness;
  availableAccounts: Account[] = [{ name: "Loading...", id: "-1"}];
  filteredAccounts: Observable<Account[]> = of(this.availableAccounts);
  newAccount: boolean = false;

  @Input() contact: Contact;

  constructor(private fb: FormBuilder, private contactService: ContactService, private accountService: AccountService) { }

  ngOnInit() {
    this.loadData();
    this.createForm();
    this.saveForm();
  }

  private loadData() {
    this.loadAccounts();
  }

  private loadAccounts() {
    this.accountService.fetchAllAccounts().subscribe(
      (accounts: Account[]) => this.handleFetchAccountsResponse(accounts),
      err => this.handleFetchAccountsError(err)
    );
  }

  private handleFetchAccountsResponse(accounts: Account[]) {
    this.availableAccounts = accounts;

    this.filteredAccounts = this.basicInfoFormGroup.controls['account'].valueChanges.pipe(
      startWith(''),
      map(value => this.filterAccount(value))
    );
  }

  private filterAccount(name: string): Account[] {
    const filterValue = name.toLowerCase();
    return this.availableAccounts.filter(account => account.name.toLowerCase().indexOf(filterValue) === 0);
  }

  private handleFetchAccountsError(err: Error) {
    console.log(err);
  }

  private saveForm() {
    this.originalFormState = this.basicInfoFormGroup.getRawValue();
  }

  private createForm() {
    if (!this.contact) this.contact = { 'status': 'NEW', 'authority': false } as Contact;

    let authority: string = this.contact.authority ? 'true' : 'false';

    this.basicInfoFormGroup = this.fb.group({
      'firstName': [this.contact.firstName, [Validators.required, Validators.pattern('^[a-zA-Z \-\]*$')]],
      'lastName': [this.contact.lastName, [Validators.required, Validators.pattern('^[a-zA-Z \-\]*$')]],
      'email': [this.contact.email, [Validators.pattern("^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$")],
      [this.emailExistsValidator()],
        'blur'
      ],
      'source': [this.contact.source, [Validators.required]],
      'sourceDetails': [this.contact.sourceDetails, [Validators.pattern('^[a-zA-Z0-9 \-\]*$')]],
      'status': [this.contact.status, [Validators.required]],
      'lineOfBusiness': [this.contact.linesOfBusiness],
      'authority': [authority],
      'title': [this.contact.title, [Validators.pattern('^[a-zA-Z \-\]*$')]],
      'account': [this.contact.account, [this.accountValidator(), Validators.required, Validators.pattern('^[a-zA-Z., \-\]*$')]]
    });
  }

  private accountValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      if (control.value == 'Loading...') {
        return { 'invalid': true };
      } 

      this.getAccount(control.value);

      return null;
    };
  }

  private emailExistsValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!this.contact.id) {
        //if we get here it's a new contact
        return this.checkEmail(control);
      } else {
        //if the user has an ID, that means a duplicate email is okay - it could be the
        //user's original email address
        if (this.originalFormState && this.originalFormState.email == control.value) {
        //if we get here the user has the same email address as always - no conflict
          return of(null);
        } else {
          //the user changed the email address - need to check
          return this.checkEmail(control);
        }
      }
    };
  }

  private checkEmail(control: AbstractControl): Observable<ValidationErrors | null> {
    if (control.value && (<string>control.value).trim().length > 0) {
      return of(control.value).pipe(
        delay(500),
        switchMap((email) => this.contactService.doesEmailExist(email).pipe(
          map(emailExists => emailExists ? { emailExists: true } : null)
        ))
      );
    } else {
      return of(null);
    }
  }

  leftAccountField() {
    this.newAccount = false;
    let account: Account = this.getAccount(this.basicInfoFormGroup.controls['account'].value);

    this.newAccount = (account && !account.id);
  }

  populateContact(contact: Contact) {
    let basicInfo: FormGroup = this.basicInfoFormGroup;

    contact.authority = (basicInfo.controls['authority'].value == 'true');
    contact.account = this.getAccount(basicInfo.controls['account'].value);
    contact.email = basicInfo.controls['email'].value;
    contact.firstName = basicInfo.controls['firstName'].value;
    contact.lastName = basicInfo.controls['lastName'].value;
    contact.linesOfBusiness = basicInfo.controls['lineOfBusiness'].value;
    contact.source = basicInfo.controls['source'].value;
    contact.sourceDetails = basicInfo.controls['sourceDetails'].value;
    contact.status = basicInfo.controls['status'].value;
    contact.title = basicInfo.controls['title'].value;
  }

  private getAccount(accountName: string): Account {
    let account: Account = null;

    if (accountName) {
      account = this.availableAccounts.find(a => a.name.toLowerCase() == accountName.toLowerCase());

      if (!account) {
        account = { name: accountName, id: null };
      }
    }

    return account;
  }
}

